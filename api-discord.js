const express = require("express");
const router = express.Router();
const axios = require("axios");
var clc = require("cli-color");

router.get('/link-minecraft', async (req, res) => {
  res.send(clc.yellow.bold('attemping to link minecraft account for discord user'));
  const discord_id = req.query.discord_id;
  // TODO: write code to check the discordSRV database for the discord_id
});


module.exports = router;