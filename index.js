const express = require("express");
const axios = require("axios");
require("@dotenvx/dotenvx").config();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { Blob } = require("buffer");
var clc = require("cli-color");
const { env } = require("process");
var minecraftRoutes = require("./api-skyblock");
var oauthRoutes = require("./api-oauth");
var skyblockRoutes = require("./api-skyblock");
var ogRoutes = require("./api-og");

const app = express();
const PORT = 4477;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

console.log(clc.blue.bold("connecting to Divnectar MongoDB...\n"));

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log(clc.green.bold("Connected to MongoDB"));
  } catch (err) {
    console.error(clc.red(err));
  }
}

connectToMongoDB();
// update
// OAuth2 details
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

if (env.NODE_ENV === 'production') {
  app.use(
    cors({
      origin: "https://divnectar.com", // Allow requests only from your frontend domain
      methods: ["GET", "POST", "OPTIONS"], // Allow the required methods
      allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
    })
  );
  console.log(clc.blue.bold('Enabled cors for divnectar.com\n'));
} else if (env.NODE_ENV === 'development') {
  app.use(
    cors({
      origin: "http://localhost:4321", // Allow requests only from your frontend domain
      methods: ["GET", "POST", "OPTIONS"], // Allow the required methods
      allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
    })
  );
  console.log(clc.blue.bold('Enabled cors for localhost:4477\n'));
}

app.use("/api/minecraft/", minecraftRoutes);
app.use("/api/oauth", oauthRoutes);
app.use("/api/skyblock", skyblockRoutes);
app.use("/api", ogRoutes)



app.listen(PORT, () => {
  console.log(clc.yellow.bold(`Listening for requests on port http://localhost:${PORT}\n`));
  var environment = process.env.NODE_ENV;
  environment = environment == 'development' ? clc.magenta.bold.underline('development') : clc.green.bold.underline('production')
  console.log(clc.yellow("Express server running in ") + environment + clc.yellow(" mode\n"));
});
