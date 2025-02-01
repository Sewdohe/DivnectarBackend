const express = require("express");
const router = express.Router();
const axios = require("axios");
var clc = require("cli-color");

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

const { client } = require("./mongoClient");

// base route /api/oauth

router.get("/discord", (req, res) => {
  console.log("Redirecting to Discord OAuth");
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=identify email guilds`;
  res.redirect(authUrl);
});

router.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("Missing code");

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      })
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch user info
    const userResponse = await axios.get("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userData = userResponse.data;

    console.log("User data:", userData);
    // Insert user into MongoDB
    try {
      const database = client.db("divnectar");
      const users = database.collection("users");

      // Check if the user already exists
      const existingUser = await users.findOne({ id: userData.id });
      if (existingUser) {
        console.log(`User ${userData.username} already exists in MongoDB`);
        // Update the existing user's information
      } else {
        await users.insertOne({
          id: userData.id,
          username: userData.username,
          avatar: userData.avatar,
          email: userData.email,
        });
        console.log("User created in MongoDB");
      }
      console.log("Creating user cookies...");

      // add cookies that we can read later
      res.cookie("userId", userData.id, {
        secure: true,
        httpOnly: false,
        sameSite: "None",
        domain: process.env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.cookie("userToken", accessToken, {
        secure: true,
        httpOnly: false,
        sameSite: "None",
        domain: process.env.COOKIE_DOMAIN,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // send back to the website with the user ID
      // so we can find them in the databse.
      if (existingUser) {
        res.redirect(
          `${process.env.AUTH_COMPLETE_REDIRECT}?returning=true&id=${userData.id}`
        );
      } else {
        res.redirect(`${process.env.AUTH_COMPLETE_REDIRECT}?id=${userData.id}`);
      }
    } catch (err) {
      console.error(err);
      res.status(500).send("Error creating user in MongoDB");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth failed");
  }
});

module.exports = router;