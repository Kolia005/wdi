const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanConfig, readConfig, effectiveEnforcement, noticeFor, DEFAULT_PRODUCTS } = require('../src/http/util/accessCampaign');
const notice = { enabled: true, products: DEFAULT_PRODUCTS, title: 'Open access has ended', message: 'See the Social Links on this experience\'s page.', studioMessage: 'Join our Discord server.', inviteUrl: 'https://discord.gg/739cf72J3n' };
test('campaign opens all three products only during its fixed window', () => {
 const config = readConfig({ ...notice, trial: { startsAt: 100, endsAt: 172900 } });
 const base = { Other: 'entitlement', [DEFAULT_PRODUCTS[1]]: 'off' };
 for (const now of [100,172899]) { const result=effectiveEnforcement(base,config,now); for (const p of DEFAULT_PRODUCTS) assert.equal(result[p],'off'); assert.equal(result.Other,'entitlement'); }
 for (const now of [99,172900,200000]) { const result=effectiveEnforcement(base,config,now); for (const p of DEFAULT_PRODUCTS) assert.equal(result[p],undefined); assert.equal(result.Other,'entitlement'); }
 assert.equal(base[DEFAULT_PRODUCTS[1]],'off');
});
test('inactive campaign preserves existing enforcement and ownership', () => {
 const base={Other:'off'}; assert.deepEqual(effectiveEnforcement(base,readConfig(notice),200),base);
 assert.equal(noticeFor(readConfig(notice),['Other']),null);
 assert.equal(noticeFor(readConfig({...notice,enabled:false}),DEFAULT_PRODUCTS),null);
 assert.equal(noticeFor(readConfig(notice),DEFAULT_PRODUCTS).inviteUrl,notice.inviteUrl);
});
test('player notice rejects direct links, but owner invitation accepts Discord URLs', () => {
 assert.throws(()=>cleanConfig({...notice,message:'Join https://discord.gg/739cf72J3n'}));
 assert.throws(()=>cleanConfig({...notice,inviteUrl:'https://evil.example/'}));
 assert.equal(cleanConfig(notice).inviteUrl,notice.inviteUrl);
});
test('invalid persisted settings fail closed', () => {
 for(const value of [null,{...notice,inviteUrl:'javascript:bad'},{...notice,trial:{startsAt:100,endsAt:90}}]) assert.equal(readConfig(value).trial,null);
 assert.equal(readConfig(null).enabled,false);
});
