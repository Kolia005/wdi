const test = require("node:test");
const assert = require("node:assert/strict");
const { buildGrantMessage } = require("../src/bot/productDelivery.js");

test("grant message omits the button when a product has no file URL", async () => {
    const message = await buildGrantMessage({ name: "Akula", fileurl: undefined });
    assert.equal(message.components.length, 0);
    assert.match(message.embeds[0].data.fields[1].value, /No download file/i);
});

test("grant message includes a link button for a permanent URL", async () => {
    const message = await buildGrantMessage({ name: "Akula", fileurl: "https://example.com/akula.rbxm" });
    assert.equal(message.components.length, 1);
    assert.equal(message.components[0].components[0].data.url, "https://example.com/akula.rbxm");
});
