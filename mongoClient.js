const { MongoClient } = require("mongodb");
require("@dotenvx/dotenvx").config();
var clc = require("cli-color");

const uri = process.env.MONGO_URI;
var client = new MongoClient(uri);

// this has been moved to a seperate file to
// facilitate the use of the mongo client in multiple files
async function connectToMongoDB() {
  console.log(clc.blue.bold("connecting to Divnectar MongoDB...\n"));
  try {
    await client.connect();
    console.log(clc.green.bold("Connected to MongoDB"));
    return client;
  } catch (err) {
    console.error(clc.red(err));
  }
}

connectToMongoDB();

module.exports = { client };