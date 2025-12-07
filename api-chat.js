const express = require('express');
const router = express.Router();
const axios = require('axios');
const mysql = require('mysql');
const { log } = require('./logger');

// ServerTAP configuration
const SERVERTAP_URL = 'https://api.divnectar.com';
const SERVERTAP_KEY = 'lesson.848.motion';

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

// Webhook endpoint for ServerTAP chat events
router.post('/webhook/chat', express.json(), async (req, res) => {
  try {
    const { player, message, type } = req.body;

    // ServerTAP sends player as an object with displayName, uuid, etc.
    const playerName = typeof player === 'string'
      ? player
      : (player?.displayName || player?.name || 'Server');

    log(`Chat webhook received: ${playerName}: ${message}`, 'info');
    log(`Full webhook data: ${JSON.stringify(req.body)}`, 'info');

    // Broadcast to all connected WebSocket clients
    const chatMessage = {
      type: 'chat',
      player: playerName,
      message: message,
      timestamp: Date.now(),
      messageType: type || 'chat'
    };

    wsClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(chatMessage));
      }
    });

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
              // Send message via ServerTAP REST API
              const command = `say §d[Web] §r<${playerName}>§r ${message}`;
              log(`Sending command to ServerTAP: ${command}`, 'info');

              const response = await axios.post(
                `${SERVERTAP_URL}/v1/server/exec`,
                { command },
                {
                  headers: {
                    'key': SERVERTAP_KEY,
                    'Content-Type': 'application/json'
                  }
                }
              );

              log(`ServerTAP response: ${JSON.stringify(response.data)}`, 'info');
              log(`Message sent to server: [Web] <${playerName}>: ${message}`, 'info');

              res.status(200).json({ success: true, playerName });
            } catch (apiError) {
              log(`Error sending message via ServerTAP: ${apiError.message}`, 'error');
              if (apiError.response) {
                log(`ServerTAP error response: ${JSON.stringify(apiError.response.data)}`, 'error');
              }
              log(`Error stack: ${apiError.stack}`, 'error');
              res.status(500).json({ error: 'Failed to send message to server: ' + (apiError.response?.data?.message || apiError.message) });
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
