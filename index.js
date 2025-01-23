const express = require('express');
const axios = require('axios');
require('dotenv').config();
const cors = require('cors')

const app = express();
const PORT = 4477;
// update
// OAuth2 details
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

app.use(cors({
  origin: 'https://divnectar.com',  // Allow requests only from your frontend domain
  methods: ['GET', 'POST', 'OPTIONS'],  // Allow the required methods
  allowedHeaders: ['Content-Type', 'Authorization'],  // Allow specific headers
}));

app.get('/api/oauth/discord', (req, res) => {
  console.log('Redirecting to Discord OAuth');
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=identify email guilds`;
  res.redirect(authUrl);
});

app.get('/api/oauth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('Missing code');

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }));

    const accessToken = tokenResponse.data.access_token;

    // Fetch user info
    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    res.json(userResponse.data); // Send user info to the frontend
  } catch (err) {
    console.error(err);
    res.status(500).send('OAuth failed');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
