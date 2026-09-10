const path = require("path");

module.exports = {
    apps: [
        {
            name: "wdi",
            script: "index.js",
            cwd: path.join(__dirname, "src"),
            interpreter: "/usr/local/bin/node24",
            env: { NODE_ENV: "production" },
            time: true,
            restart_delay: 2000,
            exp_backoff_restart_delay: 100,
            max_restarts: 10,
            min_uptime: "10s",
            max_memory_restart: "300M",
            kill_timeout: 12000,
        },
    ],
};
