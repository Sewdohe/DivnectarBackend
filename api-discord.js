const express = require("express");
const router = express.Router();
const axios = require("axios");
const mysql = require("mysql");
var clc = require("cli-color");

// Create a connection to the database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 's63_craftnectar'
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the database');
});

router.get('/link-minecraft', async (req, res) => {
  console.log(clc.yellow.bold('Attempting to link Minecraft account for Discord user'));
  const discord_id = req.query.discord_id;

  if (!discord_id) {
    return res.status(400).send('Missing discord_id');
  }

  // Query the database to check if the Discord ID exists
  const query = 'SELECT uuid FROM discordsrv_accounts WHERE discord = ?';
  db.query(query, [discord_id], (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      return res.status(500).send('Error querying the database');
    }

    if (results.length > 0) {
      const minecraft_uuid = results[0].uuid;
      return res.json({ minecraft_uuid });
    } else {
      return res.status(404).send('Discord ID not found');
    }
  });
});


module.exports = router;