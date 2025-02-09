const WebSocket = require("ws");

const wss = new WebSocket.Server({ noServer: true });

// Handle WebSocket connections
wss.on("connection", (ws) => {
  log("New WebSocket connection", "info");
  ws.on("message", (message) => {
    log(`Received message`, "info");
    log(message, "info");
  });
});

module.exports = { wss };