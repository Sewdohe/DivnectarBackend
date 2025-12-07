const express = require('express');
const router = express.Router();
const axios = require('axios');
const mysql = require('mysql');
const { Rcon } = require('rcon-client');
const { log } = require('./logger');

// ServerTAP configuration
const SERVERTAP_URL = 'https://api.divnectar.com';
const SERVERTAP_KEY = 'lesson.848.motion';

// RCON configuration
const RCON_HOST = process.env.RCON_HOST || 'localhost';
const RCON_PORT = parseInt(process.env.RCON_PORT) || 25575;
const RCON_PASSWORD = process.env.RCON_PASSWORD || '';

// MySQL connection for DiscordSRV data
const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 10
});

// Store WebSocket clients
let wsClients = [];

// Export function to set WebSocket clients
function setWebSocketClients(clients) {
  wsClients = clients;
}

// Catch-all to log any requests to webhook endpoints
router.all('/webhook/*', (req, res, next) => {
  log(`=== WEBHOOK REQUEST RECEIVED ===`, 'info');
  log(`Method: ${req.method}`, 'info');
  log(`Path: ${req.path}`, 'info');
  log(`Headers: ${JSON.stringify(req.headers)}`, 'info');
  log(`Body: ${JSON.stringify(req.body)}`, 'info');
  next();
});

// Webhook endpoint for ServerTAP chat events
router.post('/webhook/chat', express.json(), async (req, res) => {
  try {
    log(`=== CHAT WEBHOOK RECEIVED ===`, 'info');
    log(`Request body: ${JSON.stringify(req.body)}`, 'info');
    log(`Request headers: ${JSON.stringify(req.headers)}`, 'info');

    // Check if ServerTAP sent authentication
    const authKey = req.headers['key'] || req.headers['authorization'] || req.query.key;
    log(`Auth key from request: ${authKey}`, 'info');

    const { player, message, type } = req.body;

    // ServerTAP sends player as an object with displayName, uuid, etc.
    const playerName = typeof player === 'string'
      ? player
      : (player?.displayName || player?.name || 'Server');

    log(`Parsed player name: ${playerName}`, 'info');
    log(`Message: ${message}`, 'info');

    // Broadcast to all connected WebSocket clients
    const chatMessage = {
      type: 'chat',
      player: playerName,
      message: message,
      timestamp: Date.now(),
      messageType: type || 'chat'
    };

    log(`Broadcasting to ${wsClients.length} connected WebSocket clients`, 'info');
    log(`Chat message to broadcast: ${JSON.stringify(chatMessage)}`, 'info');

    let sentCount = 0;
    wsClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(chatMessage));
        sentCount++;
      }
    });

    log(`Successfully sent to ${sentCount} clients`, 'info');
    res.status(200).json({ success: true });
  } catch (error) {
    log(`Error handling chat webhook: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to send chat message to Minecraft server
router.post('/send', express.json(), async (req, res) => {
  try {
    const { message } = req.body;
    const { userId } = req.cookies;

    log(`Send message request - userId: ${userId}, message: ${message}`, 'info');

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!userId) {
      log('No userId cookie in send request', 'error');
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify user is linked to Minecraft account
    mysqlPool.query(
      'SELECT * FROM discordsrv_accounts WHERE discord = ?',
      [userId],
      async (error, results) => {
        if (error) {
          log(`Error querying DiscordSRV: ${error.message}`, 'error');
          log(`Error stack: ${error.stack}`, 'error');
          return res.status(500).json({ error: 'Database error: ' + error.message });
        }

        log(`DiscordSRV query results: ${JSON.stringify(results)}`, 'info');

        if (results.length === 0) {
          return res.status(403).json({ error: 'Minecraft account not linked. Use /discord link in-game.' });
        }

        const minecraftUuid = results[0].uuid;
        log(`Found Minecraft UUID: ${minecraftUuid}`, 'info');

        // Get player name
        mysqlPool.query(
          'SELECT name FROM plan_users WHERE uuid = ?',
          [minecraftUuid],
          async (err, userResults) => {
            if (err) {
              log(`Error fetching player name: ${err.message}`, 'error');
              log(`Error stack: ${err.stack}`, 'error');
              return res.status(500).json({ error: 'Database error: ' + err.message });
            }

            log(`Player query results: ${JSON.stringify(userResults)}`, 'info');

            const playerName = userResults.length > 0 ? userResults[0].name : 'Unknown';
            log(`Sending message as: ${playerName}`, 'info');

            try {
              // Connect to Minecraft server via RCON
              const rcon = await Rcon.connect({
                host: RCON_HOST,
                port: RCON_PORT,
                password: RCON_PASSWORD
              });

              // Send message using tellraw for better formatting
              // Format: tellraw @a [{"text":"<PlayerName> ","color":"aqua"},{"text":"message"}]
              const command = `tellraw @a [{"text":"<${playerName}> ","color":"aqua","bold":true},{"text":"${message.replace(/"/g, '\\"')}","color":"white"}]`;

              log(`Executing RCON command: ${command}`, 'info');
              const response = await rcon.send(command);

              await rcon.end();

              log(`Message sent successfully via RCON`, 'info');
              res.status(200).json({ success: true, response });
            } catch (apiError) {
              log(`Error sending message via RCON: ${apiError.message}`, 'error');
              log(`Error stack: ${apiError.stack}`, 'error');
              res.status(500).json({ error: 'Failed to send message to server: ' + apiError.message });
            }
          }
        );
      }
    );
  } catch (error) {
    log(`Error sending message to server: ${error.message}`, 'error');
    log(`Error stack: ${error.stack}`, 'error');
    res.status(500).json({ error: 'Failed to send message: ' + error.message });
  }
});

// Check if user is authenticated and linked
router.get('/auth-status', async (req, res) => {
  try {
    const { userId } = req.cookies;

    log(`Auth check - cookies: ${JSON.stringify(req.cookies)}`, 'info');
    log(`Auth check - userId: ${userId}`, 'info');

    if (!userId) {
      log('No userId cookie found', 'info');
      return res.status(200).json({
        authenticated: false,
        linked: false
      });
    }

    // Query DiscordSRV table to check if Discord ID is linked to Minecraft account
    mysqlPool.query(
      'SELECT * FROM discordsrv_accounts WHERE discord = ?',
      [userId],
      (error, results) => {
        if (error) {
          log(`Error querying DiscordSRV: ${error.message}`, 'error');
          return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
          return res.status(200).json({
            authenticated: true,
            linked: false,
            discordId: userId
          });
        }

        const minecraftUuid = results[0].uuid;

        // Get Minecraft username from Plan or CMI
        mysqlPool.query(
          'SELECT name FROM plan_users WHERE uuid = ?',
          [minecraftUuid],
          (err, userResults) => {
            if (err) {
              log(`Error fetching player name: ${err.message}`, 'error');
              return res.status(500).json({ error: 'Database error' });
            }

            const playerName = userResults.length > 0 ? userResults[0].name : 'Unknown';

            res.status(200).json({
              authenticated: true,
              linked: true,
              discordId: userId,
              minecraftUuid,
              playerName
            });
          }
        );
      }
    );
  } catch (error) {
    log(`Error checking auth status: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent chat history (optional - if you want to store messages)
router.get('/history', async (req, res) => {
  try {
    // TODO: Implement chat history from MongoDB if needed
    res.status(200).json({ messages: [] });
  } catch (error) {
    log(`Error fetching chat history: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.setWebSocketClients = setWebSocketClients;
