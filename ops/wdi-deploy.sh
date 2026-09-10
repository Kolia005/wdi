#!/usr/bin/env bash
set -euo pipefail

APP=/root/actions-runner/deploy/wdi/wdi
LOG=/root/wdi-deploy.log
NODE_HOME=/opt/node24
export PATH="$NODE_HOME/bin:$PATH"
export PM2_HOME=/root/.pm2

cd "$APP"
echo "[$(date -u +%FT%TZ)] deploy start" >> "$LOG"
BEFORE=$(git rev-parse HEAD)

git fetch nick main >> "$LOG" 2>&1
git reset --hard nick/main >> "$LOG" 2>&1
AFTER=$(git rev-parse HEAD)

# Secrets live outside Git and are restored after every checkout.
cp /root/wdi.env "$APP/src/.env"

# A clean install plus fast checks prevents a broken dependency or command schema
# from replacing the currently running bot.
npm ci --no-audit --no-fund >> "$LOG" 2>&1
npm test >> "$LOG" 2>&1
npm run check >> "$LOG" 2>&1

# Recreate only the bot entry so PM2 cannot retain its former Node 16 interpreter.
pm2 delete wdi >> "$LOG" 2>&1 || true
pm2 start "$APP/ecosystem.config.cjs" --only wdi --update-env >> "$LOG" 2>&1

CODE=000
for _ in $(seq 1 20); do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3000/health || true)
    if [ "$CODE" = "200" ]; then
        break
    fi
    sleep 2
done

if [ "$CODE" != "200" ]; then
    echo "[$(date -u +%FT%TZ)] deploy failed healthcheck=$CODE commit=$AFTER" >> "$LOG"
    exit 1
fi

pm2 save >> "$LOG" 2>&1
echo "[$(date -u +%FT%TZ)] deployed $BEFORE -> $AFTER healthcheck=$CODE node=$(node --version)" >> "$LOG"
