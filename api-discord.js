const express = require("express");
const router = express.Router();
const axios = require("axios");
const mysql = require("mysql");
const { log } = require("./logger");
var { client } = require("./mongoClient")
const { env } = require("process");

// Create a connection to the database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  log('Connected to the database');
});

router.get('/link-minecraft', async (req, res) => {
  log('Attempting to link Minecraft account for Discord user', "info");
  const discord_id = req.query.discord_id;

  if (!discord_id) {
    return res.status(400).send('Missing discord_id');
  }

  // Query the database to check if the Discord ID exists
  const query = 'SELECT uuid FROM discordsrv_accounts WHERE discord = ?';
  db.query(query, [discord_id], async (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      return res.status(500).send('Error querying the database');
    }

    if (results.length > 0) {
      const minecraft_uuid = results[0].uuid;
      //TODO: Insert the UUID into the users profile on MongoDB
      const db = client.db("divnectar");
      const collection = db.collection('users');
      await collection.updateOne(
        { id: discord_id },
        { $set: { minecraft_uuid: minecraft_uuid } },
        { upsert: true }
      );
      slog('Minecraft UUID added to user data in MongoDB', "info");

      if (env.NODE_ENV === "production") {
        res.redirect('https://divnectar.com/profile?just_linked=true');
      } else if (env.NODE_ENV === "development") {
        res.redirect('http://localhost:4321/profile?just_linked=true');
      }
    } else {
      if (env.NODE_ENV === "production") {
        res.redirect('https://divnectar.com/profile?just_linked=false?err=minecraft_uuid_not_found');
      } else if (env.NODE_ENV === "development") {
        res.redirect('http://localhost:4321/profile?just_linked=false?err=minecraft_uuid_not_found');
      }
    }
  });
});


module.exports = router;