const Setting = require('../../model/Setting.js');

const KEY = 'accessCampaign';
const DEFAULT_PRODUCTS = ['Advanced Vehicle Combat System', 'German Military Vehicles Pack', 'US Military Vehicles Pack'];
const DEFAULT_MESSAGE = 'Open access has ended. To continue using this asset, visit the Social Links on this experience\'s page.';
const DEFAULT_STUDIO_MESSAGE = 'Open access has ended. If you would like to continue using this asset, join our Discord server.';

function text(value, fallback, limit) {
    if (typeof value !== 'string') return fallback;
    return value.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, limit);
}
function cleanConfig(value = {}) {
    const products = [...new Set((Array.isArray(value.products) ? value.products : DEFAULT_PRODUCTS)
        .filter(p => typeof p === 'string' && p.trim() && !['__proto__', 'constructor', 'prototype'].includes(p.trim()))
        .map(p => p.trim().slice(0, 120)))].slice(0, 30);
    const title = text(value.title, 'Open access has ended', 120);
    const message = text(value.message, DEFAULT_MESSAGE, 1200);
    const studioMessage = text(value.studioMessage, DEFAULT_STUDIO_MESSAGE, 1200);
    const inviteUrl = text(value.inviteUrl, '', 200);
    if (inviteUrl && !/^https:\/\/(?:discord\.gg\/[A-Za-z0-9-]+|discord\.com\/invite\/[A-Za-z0-9-]+)$/.test(inviteUrl)) {
        throw new Error('Use a valid https://discord.gg/ invite.');
    }
    // In-experience messages refer players to Social Links. The direct invite is owner-facing only.
    if (/(?:https?:\/\/|www\.|discord\s*\.\s*(?:gg|com)|[A-Za-z0-9-]+\.(?:com|net|org|gg|io)\b)/i.test(title + ' ' + message)) {
        throw new Error('Put external links in the Studio invite field; the player message should refer to Social Links.');
    }
    return { enabled: value.enabled === true, products, title, message, studioMessage, inviteUrl };
}
function cleanTrial(value) {
    if (!value || !Number.isFinite(value.startsAt) || !Number.isFinite(value.endsAt) || value.startsAt <= 0 || value.endsAt < value.startsAt) return null;
    return { startsAt: Math.floor(value.startsAt), endsAt: Math.floor(value.endsAt) };
}
function readConfig(value) {
    try { return { ...cleanConfig(value), trial: cleanTrial(value && value.trial) }; }
    catch { return { ...cleanConfig(), trial: null }; }
}
async function getAccessCampaign() {
    const doc = await Setting.findOne({ key: KEY }).lean();
    return readConfig(doc && doc.value);
}
async function saveNotice(value) {
    const clean = cleanConfig(value);
    if (!clean.products.length || !clean.title || !clean.message || !clean.studioMessage) throw new Error('Products, title and both messages are required.');
    const current = await getAccessCampaign();
    if (current.trial && Date.now() / 1000 < current.trial.endsAt && JSON.stringify(clean.products.slice().sort()) !== JSON.stringify(current.products.slice().sort())) {
        throw new Error('End the current trial before changing its products.');
    }
    const next = { ...clean, trial: current.trial };
    await Setting.updateOne({ key: KEY }, { $set: { value: next, updated: new Date() } }, { upsert: true });
    return next;
}
async function startTrial(now = Math.floor(Date.now() / 1000)) {
    const current = await getAccessCampaign();
    if (!current.enabled || !current.products.length) throw new Error('Save and enable the notice before starting open access.');
    if (current.trial && now < current.trial.endsAt) throw new Error('Open access is already active; its deadline was not extended.');
    const next = { ...current, trial: { startsAt: now, endsAt: now + 48 * 60 * 60 } };
    // Atomic guard prevents duplicate panel submissions from extending the trial.
    const doc = await Setting.findOneAndUpdate(
        { key: KEY, 'value.trial': current.trial },
        { $set: { value: next, updated: new Date() } }, { new: true }
    ).lean();
    if (!doc) throw new Error('The access settings changed; reload the panel and try again.');
    return next;
}
async function endTrial(now = Math.floor(Date.now() / 1000)) {
    const current = await getAccessCampaign();
    if (!current.trial) throw new Error('No trial has been started.');
    const next = { ...current, trial: { ...current.trial, endsAt: Math.max(current.trial.startsAt, Math.min(now, current.trial.endsAt)) } };
    await Setting.updateOne({ key: KEY }, { $set: { value: next, updated: new Date() } });
    return next;
}
function effectiveEnforcement(base, campaign, now = Math.floor(Date.now() / 1000)) {
    const map = { ...(base || {}) };
    if (!campaign.trial) return map;
    const active = now >= campaign.trial.startsAt && now < campaign.trial.endsAt;
    for (const product of campaign.products) {
        if (active) map[product] = 'off';
        else delete map[product]; // full enforcement resumes, even if an older manual override was off.
    }
    return map;
}
function noticeFor(campaign, products) {
    if (!campaign.enabled || !products.some(p => campaign.products.includes(p))) return null;
    return { title: campaign.title, message: campaign.message, studioMessage: campaign.studioMessage, inviteUrl: campaign.inviteUrl };
}
module.exports = { KEY, DEFAULT_PRODUCTS, DEFAULT_MESSAGE, DEFAULT_STUDIO_MESSAGE, cleanConfig, readConfig, getAccessCampaign, saveNotice, startTrial, endTrial, effectiveEnforcement, noticeFor };
