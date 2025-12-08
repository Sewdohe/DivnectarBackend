const express = require("express");
require("@dotenvx/dotenvx").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { env } = require("process");
const http = require("http");
const WebSocket = require("ws");

const { log } = require("./logger");
const { initializeScheduledTasks } = require("./scheduled-tasks");

// express init
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = 4477;

// Middleware
app.use(express.json());
app.use(cookieParser());

// set cors for the current development environment
if (env.NODE_ENV === "production") {
  app.use(
    cors({
      origin: "https://divnectar.com", // Allow requests only from your frontend domain
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow the required methods
      allowedHeaders: ["Content-Type", "Authorization"], // Explicitly allow these headers
      credentials: true, // Allow cookies
    })
  );
  log("Enabled cors for divnectar.com\n", "info");
} else if (env.NODE_ENV === "development") {
  app.use(
    cors({
      origin: "http://localhost:4321", // Allow requests only from your frontend domain
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Allow the required methods
      allowedHeaders: ["Content-Type", "Authorization"], // Explicitly allow these headers
      credentials: true, // Allow cookies
    })
  );
  log("Enabled cors for localhost:4321\n", "info");
}

// Import the various route files
var oauthRoutes = require("./api-oauth");
var ogRoutes = require("./api-og");
var discordRoutes = require("./api-discord");
var chatRoutes = require("./api-chat");
var adminRoutes = require("./api-admin");

// Declare sectioned off routes
app.use("/api/oauth", oauthRoutes);
app.use("/api/discord", discordRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", ogRoutes);

// WebSocket connection handling
const wsClients = [];

wss.on('connection', (ws) => {
  log('New WebSocket client connected', 'info');
  wsClients.push(ws);

  ws.on('close', () => {
    log('WebSocket client disconnected', 'info');
    const index = wsClients.indexOf(ws);
    if (index > -1) {
      wsClients.splice(index, 1);
    }
  });

  ws.on('error', (error) => {
    log(`WebSocket error: ${error.message}`, 'error');
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'system',
    message: 'Connected to DivNectar chat',
    timestamp: Date.now()
  }));
});

// Share WebSocket clients with chat routes
chatRoutes.setWebSocketClients(wsClients);

// start the express server with WebSocket support
// and log the environment
server.listen(PORT, () => {
  log(`Listening for requests at ${env.NODE_ENV === "development" ? 'http://localhost' : 'https://backend.divnectar.com'}:${PORT}\n`, "info");
  log(`WebSocket server running on same port\n`, "info");
  var environment = process.env.NODE_ENV;
  environment =
    environment == "development"
      ? "development"
      : "production";
  log("Express server running in " + environment + " mode\n", "info");

  // Initialize scheduled tasks (OG image cleanup, etc.)
  initializeScheduledTasks();
});
