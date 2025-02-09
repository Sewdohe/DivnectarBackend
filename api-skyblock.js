const express = require("express");
const router = express.Router();
const axios = require("axios");
var bodyParser = require("body-parser");
var jsonParser = bodyParser.json();
const { log } = require("./logger");
const { wss } = require("./websocket"); // Import the server instance
const WebSocket = require("ws");
const { client } = require("./mongoClient")

//added websocket lib tto skyblok

// Broadcast function to send data to all connected clients
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Endpoint to receive events from Minecraft server
router.post("/events", jsonParser, (req, res) => {
  const event = req.body;
  log("Received event:", "info");
  log(event)

  const collection = client.db("skyblock").collection("events");
  collection.insertOne(event, (err, result) => {
    if (err) {
      log("Error inserting event into MongoDB", "error");
      log(err, "error");
    } else {
      log("Event inserted into MongoDB", "info");
    }
  });

  // Broadcast the event to all connected WebSocket clients
  broadcast(event);

  res.status(200).send("Event received");
});

// Endpoint to retrieve the last 30 events
router.get("/events", async (req, res) => {
  const collection = client.db("skyblock").collection("events");
  const events = await collection.find().sort({ _id: -1 }).limit(30).toArray();
  res.json(events);
});

// all routes prefixed with /api/minecraft
router.get("/players", async (req, res) => {
  const serverTAPUrl = "https://api.divnectar.com";
  const serverTAPKey = process.env.SERVERTAP_API_KEY;
  log(
    `ServerTAP Key: ${serverTAPKey} | hitting ${serverTAPUrl}`,
    "info"
  );

  const headers = {
    key: `${serverTAPKey}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(`${serverTAPUrl}/v1/players`, { headers });
    if (response.status !== 200) {
      throw new Error("Failed to get online player list");
    }
    log(`Players: ${response.data}`, "info");
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
  log(
    `ServerTAP Key: ${serverTAPKey} | hitting ${serverTAPUrl}`,
    "info"
  );

  const headers = {
    key: `${serverTAPKey}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await axios.get(`${serverTAPUrl}/v1/players/all`, {
      headers,
    });
    if (response.status !== 200) {
      throw new Error("Failed to get complete player list");
    }
    log(`All Players: ${response.data}`, "info");
    res.send(response.data);
  } catch (error) {
    console.error("Error getting all players:", error);
    res.status(500).send("Error getting all players");
  }
});

router.post("/command", async (req, res) => {
  const command = req.query.command;
  log("Request to run as command on skyblock", "info");

  if (!command) {
    return res.status(400).send("Missing command");
  }

  const serverTAPUrl = "http://api.divnectar.com";
  const serverTAPKey = process.env.SERVERTAP_API_KEY;

  const data = {
    command: command,
    time: 0,
  };

  log(data, "info");

  try {
    log("Running command on skyblock:", "info");
    const response = await axios.post(`${serverTAPUrl}/v1/server/exec`, data, {
      headers: {
        key: `${serverTAPKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    if (response.status !== 200) {
      throw new Error("Failed to run command");
    }
    log("Command executed successfully", "info");
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
    key: `${serverTAPKey}`,
    "Content-Type": "application/json",
  };

  const data = {
    command: `${command}`,
  };

  try {
    const response = await axios.post(
      `${serverTAPUrl}/v1/players/${uuid}`,
      data,
      { headers }
    );
    if (response.status !== 200) {
      throw new Error("Failed to search for player name");
    }
    log(`Player found: ${response.data.displayName}`, "info");
    res.send("Command executed successfully");
  } catch (error) {
    console.error("Error running command:", error);
    res.status(500).send("Error running command");
  }
});

router.post("/player/online", jsonParser, async (req, res) => {
  const uuid = req.body.uuid;

  if (!uuid) {
    return res.status(400).send("Missing player UUID or message");
  }

  const serverTAPUrl = "https://api.divnectar.com";
  const serverTAPKey = process.env.SERVERTAP_API_KEY;

  const headers = {
    key: `${serverTAPKey}`,
    "Content-Type": "multipart/form-data",
  };

  const data = new FormData();
  data.append("uuid", uuid);
  data.append("message", "%player_online%");

  try {
    const response = await axios.post(
      `${serverTAPUrl}/v1/placeholders/replace`,
      data,
      { headers }
    );
    if (response.status !== 200) {
      throw new Error("Failed to get online status");
    }
    log(
      `player ${response.data == true ? "is" : "is not"} online`,
      "info"
    );
    res.send(response.data);
  } catch (error) {
    console.error("Error getting online status:", error);
    res.status(500).send("Error getting online status: ");
  }
});

module.exports = router;
