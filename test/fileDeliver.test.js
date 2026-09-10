const test = require("node:test");
const assert = require("node:assert/strict");
const { isUsableDownloadUrl, refreshDiscordUrl } = require("../src/bot/fileDeliver.js");

test("download URL validation accepts only HTTP(S) URLs", () => {
    assert.equal(isUsableDownloadUrl("https://example.com/file.rbxm"), true);
    assert.equal(isUsableDownloadUrl("http://example.com/file.rbxm"), true);
    assert.equal(isUsableDownloadUrl(undefined), false);
    assert.equal(isUsableDownloadUrl(""), false);
    assert.equal(isUsableDownloadUrl("javascript:alert(1)"), false);
    assert.equal(isUsableDownloadUrl("not a URL"), false);
});

test("refreshDiscordUrl safely rejects a missing URL", async () => {
    assert.equal(await refreshDiscordUrl(undefined), null);
    assert.equal(await refreshDiscordUrl("not a URL"), null);
});
