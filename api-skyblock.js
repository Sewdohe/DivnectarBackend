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

router.post("/command", async (req, res) => {
  const command = req.query.command;
  console.log(clc.yellow("Request to run as command on skyblock", command));

  if (!command) {
    return res.status(400).send("Missing command");
  }

  const serverTAPUrl = "http://api.divnectar.com";
  const serverTAPKey = process.env.SERVERTAP_API_KEY;

  const data = {
    command: command,
    time: 0
  };

  console.log(data)

  try {
    console.log(clc.blue("Running command on skyblock:"), clc.yellow(command));
    const response = await axios.post(`${serverTAPUrl}/v1/server/exec`, data, {
      headers: {
        "key": `${serverTAPKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      }
    });
    if (response.status !== 200) {
      throw new Error("Failed to run command");
    }
    console.log(clc.green("Command executed successfully"));
    res.send("Command executed successfully");
  } catch (error) {
    console.error("Error running command:", error);
    // res.status(500).send("Error running command");
  }
});

router.post("/get-player", async (req, res) => {
  const { uuid } = req.body;

  if (!uuid) {
    return res.status(400).send("Missing player UUID");
  }

  const serverTAPUrl = "https://api.divnectar.com";
  const serverTAPKey = process.env.SERVERTAP_API_KEY;

  const headers = {
    "key": `${serverTAPKey}`,
    "Content-Type": "application/json",
  };

  const data = {
    command: `${command}`,
  };

  try {
    const response = await axios.post(`${serverTAPUrl}/v1/players/${uuid}`, data, { headers });
    if (response.status !== 200) {
      throw new Error("Failed to search for player name");
    }
    console.log(clc.green(`Player found: ${response.data.displayName}`));
    res.send("Command executed successfully");
  } catch (error) {
    console.error("Error running command:", error);
    res.status(500).send("Error running command");
  }
});

module.exports = router;
