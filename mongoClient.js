const { MongoClient } = require("mongodb");
require("@dotenvx/dotenvx").config();
const { log } = require("./logger");

const uri = process.env.MONGO_URI;
var client = new MongoClient(uri);

// this has been moved to a seperate file to
// facilitate the use of the mongo client in multiple files
async function connectToMongoDB() {
  log("connecting to Divnectar MongoDB...\n", "info");
  try {
    await client.connect();
    log("Connected to MongoDB", "info");
    return client;
  } catch (err) {
    console.error(clc.red(err));
  }
}

connectToMongoDB();

module.exports = { client };