const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { EmbedBuilder } = require("discord.js");

const botRoot = path.join(__dirname, "..", "src", "bot");

function javascriptFiles(root) {
    return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) return javascriptFiles(fullPath);
        return entry.isFile() && entry.name.endsWith(".js") ? [fullPath] : [];
    });
}

test("the shared embed color is accepted by the installed discord.js", () => {
    const embed = new EmbedBuilder().setColor("#2f3136");
    assert.equal(embed.data.color, 0x2f3136);
});

test("bot sources do not use quoted 0x embed colors", () => {
    const invalid = [];

    for (const file of javascriptFiles(botRoot)) {
        const source = fs.readFileSync(file, "utf8");
        const matches = source.match(/["']0x[0-9a-f]{6}["']/gi) ?? [];
        for (const match of matches) {
            invalid.push(`${path.relative(botRoot, file)}: ${match}`);
        }
    }

    assert.deepEqual(invalid, []);
});
