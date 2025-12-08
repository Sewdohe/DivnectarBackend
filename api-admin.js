const express = require('express');
const router = express.Router();
const mysql = require('mysql');
const { Rcon } = require('rcon-client');
const { log } = require('./logger');
const { client: mongoClient } = require('./mongoClient');

// MySQL connection pool
const mysqlPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  connectionLimit: 10
});

// RCON configuration
const RCON_HOST = process.env.RCON_HOST || 'localhost';
const RCON_PORT = parseInt(process.env.RCON_PORT) || 25575;
const RCON_PASSWORD = process.env.RCON_PASSWORD || '';

// Middleware to check if user is admin
async function isAdmin(req, res, next) {
  try {
    const { userId } = req.cookies;

    log(`Admin auth check - userId from cookie: ${userId}`, 'info');

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get user from MongoDB (users are stored with 'id' field, not '_id')
    const db = mongoClient.db('divnectar');
    const user = await db.collection('users').findOne({ id: userId });

    log(`User lookup result: ${user ? user.username : 'not found'}`, 'info');

    if (!user || user.username !== 'sewdohe') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    next();
  } catch (error) {
    log(`Error checking admin status: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/admin/players - Get all Minecraft players
router.get('/players', isAdmin, async (req, res) => {
  try {
    mysqlPool.query(
      `SELECT
        c.player_uuid,
        c.Username as username,
        c.TotalPlayTime as total_playtime,
        c.Balance as balance,
        pu.name,
        s.session_start,
        s.session_end,
        CASE
          WHEN s.session_end IS NULL AND s.session_start IS NOT NULL THEN 1
          ELSE 0
        END as is_online
      FROM CMI_users c
      LEFT JOIN plan_users pu ON c.player_uuid = pu.uuid
      LEFT JOIN plan_sessions s ON pu.id = s.user_id AND s.session_end IS NULL
      WHERE c.FakeAccount IS NULL OR c.FakeAccount = 0
      ORDER BY is_online DESC, c.TotalPlayTime DESC
      LIMIT 100`,
      (error, results) => {
        if (error) {
          log(`Error fetching players: ${error.message}`, 'error');
          return res.status(500).json({ error: 'Database error' });
        }

        res.status(200).json({ players: results });
      }
    );
  } catch (error) {
    log(`Error in /admin/players: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/command - Execute RCON command
router.post('/command', isAdmin, express.json(), async (req, res) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }

    log(`Admin executing command: ${command}`, 'info');

    // Connect to Minecraft server via RCON
    const rcon = await Rcon.connect({
      host: RCON_HOST,
      port: RCON_PORT,
      password: RCON_PASSWORD
    });

    const response = await rcon.send(command);
    await rcon.end();

    log(`Command executed successfully: ${response}`, 'info');
    res.status(200).json({ success: true, response: response || 'Command executed successfully' });
  } catch (error) {
    log(`Error executing command: ${error.message}`, 'error');
    res.status(500).json({ error: 'Failed to execute command: ' + error.message });
  }
});

// GET /api/admin/users - Get all OAuth users
router.get('/users', isAdmin, async (req, res) => {
  try {
    const db = mongoClient.db('divnectar');
    const users = await db.collection('users').find({}).toArray();

    // Get Minecraft link status for each user
    const usersWithLinkStatus = await Promise.all(
      users.map(async (user) => {
        return new Promise((resolve) => {
          mysqlPool.query(
            'SELECT uuid FROM discordsrv_accounts WHERE discord = ?',
            [user.id],
            async (error, results) => {
              if (error || results.length === 0) {
                resolve({
                  ...user,
                  minecraftLinked: false,
                  minecraftUuid: null,
                  minecraftName: null
                });
                return;
              }

              const uuid = results[0].uuid;

              // Get player name
              mysqlPool.query(
                'SELECT name FROM plan_users WHERE uuid = ?',
                [uuid],
                (err, nameResults) => {
                  const name = nameResults && nameResults.length > 0 ? nameResults[0].name : null;
                  resolve({
                    ...user,
                    minecraftLinked: true,
                    minecraftUuid: uuid,
                    minecraftName: name
                  });
                }
              );
            }
          );
        });
      })
    );

    res.status(200).json({ users: usersWithLinkStatus });
  } catch (error) {
    log(`Error fetching users: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/console - Get recent console logs
// Note: This is a placeholder - actual implementation would require
// storing console logs or using a log file reader
router.get('/console', isAdmin, async (req, res) => {
  try {
    // For now, return empty array
    // In a real implementation, you'd read from a log file or database
    res.status(200).json({
      logs: [
        { timestamp: Date.now(), level: 'info', message: 'Console log streaming not yet implemented' },
        { timestamp: Date.now(), level: 'info', message: 'Use the command runner below to execute server commands' }
      ]
    });
  } catch (error) {
    log(`Error fetching console logs: ${error.message}`, 'error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
