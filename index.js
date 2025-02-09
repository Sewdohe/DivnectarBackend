const express = require("express");
require("@dotenvx/dotenvx").config();
const cors = require("cors");
var clc = require("cli-color");
const { env } = require("process");

// Import the various route files
var minecraftRoutes = require("./api-skyblock");
var oauthRoutes = require("./api-oauth");
var skyblockRoutes = require("./api-skyblock");
var ogRoutes = require("./api-og");
var discordRoutes = require("./api-discord");

const { log } = require("./logger");

// express init
const app = express();
const PORT = 4477;

// set cors for the current development environment
if (env.NODE_ENV === "production") {
  app.use(
    cors({
      origin: "https://divnectar.com", // Allow requests only from your frontend domain
      methods: ["GET", "POST", "OPTIONS"], // Allow the required methods
      allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
    })
  );
  log("Enabled cors for divnectar.com\n", "info");
} else if (env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: "http://localhost:4321", // Allow requests only from your frontend domain
      methods: ["GET", "POST", "OPTIONS"], // Allow the required methods
      allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
    })
  );
  log("Enabled cors for localhost:4477\n", "info");
}

// Import sectioned off routes
app.use("/api/minecraft/", minecraftRoutes);
app.use("/api/oauth", oauthRoutes);
app.use("/api/skyblock", skyblockRoutes);
app.use("/api/discord", discordRoutes);
app.use("/api", ogRoutes);

// start the express server
// and log the environment
app.listen(PORT, () => {
  log(
    `Listening for requests at http://localhost:${PORT}\n`, "info"
  );
  var environment = process.env.NODE_ENV;
  environment =
    environment == "development"
      ? clc.magenta.bold.underline("development")
      : clc.green.bold.underline("production");
  log(
   "Express server running in " +
      environment +
      " mode\n", "info"
  );
});
