const express = require("express");
const router = express.Router();
const axios = require("axios");
var clc = require("cli-color");

// all routes prefixed with /api/minecraft
router.get("/players", async (req, res) => {
  const serverTAPUrl = "https://api.divnectar.com";
  const serverTAPKey = process.env.SERVERTAP_API_KEY;
	console.log(clc.yellow.bold(`ServerTAP Key: ${serverTAPKey} | hitting ${serverTAPUrl}`));

  const headers = {
    key: `${serverTAPKey}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(
      `${serverTAPUrl}/v1/players`,
      { headers }
    );
    if (response.status !== 200) {
      throw new Error("Failed to get online player list");
    }
    console.log(clc.green(`Players: ${response.data}`));
    res.send(response.data);
  } catch (error) {
    console.error("Error getting players:", error);
    res.status(500).send("Error getting players");
  }
});

// /api/minecraft/players/all
router.get("/players/all", async (req, res) => {
  const serverTAPUrl = "https://api.divnectar.com";
  const serverTAPKey = process.env.SERVERTAP_API_KEY;
	console.log(clc.yellow.bold(`ServerTAP Key: ${serverTAPKey} | hitting ${serverTAPUrl}`));

  const headers = {
    key: `${serverTAPKey}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(
      `${serverTAPUrl}/v1/players/all`,
      { headers }
    );
    if (response.status !== 200) {
      throw new Error("Failed to get complete player list");
    }
    console.log(clc.green(`All Players: ${response.data}`));
    res.send(response.data);
  } catch (error) {
    console.error("Error getting all players:", error);
    res.status(500).send("Error getting all players");
  }
});

module.exports = router;
