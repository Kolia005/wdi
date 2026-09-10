const fs = require("fs");
const path = require("path");

const commandsPath = path.join(__dirname, "..", "src", "bot", "commands");
const files = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js"));
const names = new Set();

for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (!command.data || typeof command.data.toJSON !== "function") {
        throw new Error(`${file} does not export slash-command data`);
    }
    if (typeof command.run !== "function") {
        throw new Error(`${file} does not export a run function`);
    }

    const json = command.data.toJSON();
    if (!json.name || !json.description) throw new Error(`${file} has invalid command data`);
    if (names.has(json.name)) throw new Error(`Duplicate slash-command name: ${json.name}`);
    names.add(json.name);
}

console.log(`Validated ${files.length} Discord commands.`);
