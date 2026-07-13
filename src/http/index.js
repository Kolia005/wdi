const express = require("express");
const { verifLogger } = require("./verifLog.js");

const app = express();
let mongoClient;
app.use((req, res, next) => {
  req.mongoClient = mongoClient;
  res.setHeader("X-Powered-By", "WDI");
  next();
});

app.use(verifLogger);

app.get("/", (_, res) => {
  res.status(200).send("OK");
});

app.get("/health", (_, res) => res.status(200).json({ok:true,service:"wdi"}));

app.get("/gay", (_, res) => {
  res.status(200).send("WORKS");
});

app.get("/wl", require("./routes/wl.js"));
app.get("/wln", require("./routes/wln.js"));
app.get("/wlt", require("./routes/wlt.js"));
app.get("/wlv2", require("./routes/wlv2.js"));
app.get("/verify", require("./routes/verify.js"));
app.use("/internal", require("./internal.js"));
app.use("/wix", require("./wixRoutes.js"));
app.use("/files", express.static(require("path").join(__dirname, "..", "..", "product-files")));

app.get("*", (_, res) => {
  res.status(404).send("Not Found");
});

module.exports = () => {
  app.listen(process.env.PORT, () => {
    console.log(`Listening on port ${process.env.PORT}`);
  });
};
