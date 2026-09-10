const test = require("node:test");
const assert = require("node:assert/strict");
const { encodeFile } = require("../src/util/lib.js");

test("product files are base64 encoded without corrupting binary bytes", () => {
    const bytes = Buffer.from([0, 1, 2, 127, 128, 254, 255]);
    assert.equal(encodeFile(bytes), bytes.toString("base64"));
    assert.deepEqual(Buffer.from(encodeFile(bytes), "base64"), bytes);
});

test("product encoder rejects non-binary input", () => {
    assert.throws(() => encodeFile("not binary"), /binary data/);
});
