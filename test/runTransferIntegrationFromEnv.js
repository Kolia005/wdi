// Test helper for the deployed host. It reads the normal Mongo URI, changes
// only the database name to a disposable test database, and never prints the
// credential-bearing URI.
const path = process.env.WDI_ENV_PATH;
if (!path) throw new Error("WDI_ENV_PATH is required");

require("dotenv").config({ path });
if (!process.env.DB_URI) throw new Error("DB_URI is missing from WDI_ENV_PATH");

const uri = new URL(process.env.DB_URI);
process.env.TRANSFER_TEST_DB_URI = uri.toString();
process.env.TRANSFER_TEST_COLLECTION_PREFIX = "wdi_transfer_test";

require("./transferService.integration.js");
