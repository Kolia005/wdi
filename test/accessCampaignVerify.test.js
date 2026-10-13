const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const campaignUtil = require('../src/http/util/accessCampaign');
const Setting = require('../src/model/Setting');
const { DEFAULT_PRODUCTS } = campaignUtil;
const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
let owned = [], killed = false, stored = null;
function mock(path, exports) { require.cache[require.resolve(path)] = { id: require.resolve(path), filename: require.resolve(path), loaded: true, exports }; }
mock('../src/http/util/roblox', { resolveOwner: async()=>({universeId:'123',ownerId:'456'}), fullEntitlement: async()=>owned, universeGrants: async()=>[] });
mock('../src/model/KillList', { findOne: ()=>({lean:async()=>killed?{active:true}:null}) });
mock('../src/http/util/vehiclePackPolicy', { getVehiclePackPolicy: async()=>({}) });
mock('../src/http/util/wrapAsync', fn=>fn);
mock('../src/http/util/signer', { signPayload: payload=> {const encoded=Buffer.from(JSON.stringify(payload)).toString('base64');return {payload:encoded,rsa:crypto.sign('sha256',Buffer.from(encoded),keys.privateKey).toString('base64')};} });
Setting.findOne = ({key})=>({lean:async()=>key==='accessCampaign'?{value:stored}:null});
Setting.findOneAndUpdate = (filter, update)=>({lean:async()=>{if(JSON.stringify(stored.trial)!==JSON.stringify(filter['value.trial']))return null;stored=update.$set.value;return {value:stored};}});
const verify=require('../src/http/routes/verify');
async function response() {
 let body;
 const res={locals:{},set(){},status(){return this;},json(v){body=v;return this;}};
 await verify({query:{place:'12',universe:'123',product:DEFAULT_PRODUCTS[0],nonce:'test'},headers:{}},res,e=>{throw e;});
 assert.ok(crypto.verify('sha256',Buffer.from(body.payload),keys.publicKey,Buffer.from(body.rsa,'base64')));
 return JSON.parse(Buffer.from(body.payload,'base64'));
}
test('signed verification grants active trial, denies expired copies, and preserves paid licenses and kills', async()=>{
 const now=Math.floor(Date.now()/1000);
 stored={enabled:true,products:DEFAULT_PRODUCTS,title:'Open access has ended',message:'See the Social Links on the experience page.',studioMessage:'Join our Discord server.',inviteUrl:'https://discord.gg/739cf72J3n',trial:{startsAt:now-1,endsAt:now+60}};
 owned=[];killed=false;
 let p=await response();assert.equal(p.lic,true);assert.equal(p.u,'123');assert.equal(p.nonce,'test');assert.equal(p.packs.length,0);assert.equal(p.notice.inviteUrl,stored.inviteUrl);
 stored.trial.endsAt=now;
 p=await response();assert.equal(p.lic,false);for(const product of DEFAULT_PRODUCTS)assert.equal(p.enf[product],undefined);
 owned=[...DEFAULT_PRODUCTS];p=await response();assert.equal(p.lic,true);assert.deepEqual(p.packs,DEFAULT_PRODUCTS);
 killed=true;p=await response();assert.equal(p.lic,false);assert.deepEqual(p.packs,[]);
});
test('starting a trial fixes its 48-hour deadline and rejects a second start',async()=>{
 const now=Math.floor(Date.now()/1000);
 stored={enabled:true,products:DEFAULT_PRODUCTS,title:'Open access has ended',message:'See the Social Links on the experience page.',studioMessage:'Join our Discord server.',inviteUrl:'https://discord.gg/739cf72J3n',trial:null};
 const started=await campaignUtil.startTrial(now);assert.equal(started.trial.endsAt-now,172800);
 await assert.rejects(campaignUtil.startTrial(now+1),/already active/);
 assert.equal(stored.trial.endsAt,now+172800);
});
