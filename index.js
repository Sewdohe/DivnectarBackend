const express = require("express");
const axios = require("axios");
require("@dotenvx/dotenvx").config();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { Blob } = require("buffer");

const app = express();
const PORT = 4477;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

console.log("connecting to Divnectar MongoDB...");

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error(err);
  }
}

connectToMongoDB();

// update
// OAuth2 details
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

app.use(
  cors({
    origin: "https://divnectar.com", // Allow requests only from your frontend domain
    methods: ["GET", "POST", "OPTIONS"], // Allow the required methods
    allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
  })
);

app.get("/api/oauth/discord", (req, res) => {
  console.log("Redirecting to Discord OAuth");
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=identify email guilds`;
  res.redirect(authUrl);
});

app.get("/api/oauth/callback", async (req, res) => {
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

app.get("/api/og-image", async (req, res) => {
  //TODO: write OG image function
  const TOKEN = process.env.BROWSERLESS_TOKEN;
  const url = `https://browserless.divnectar.com/screenshot?token=${TOKEN}`;
  const headers = {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
  };
  const data = {
    url: req.query.url,
    options: {
      fullPage: true,
      type: "png",
    },
  };

  try {
    const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });
    const imageBuffer = response.data
    const screenshotUrl = await uploadImageToStrapi(imageBuffer, req.query.url);
    // the upload function returns the URL sent to the client.
    res.send(screenshotUrl)
  } catch (error) {
    console.error("Error taking screenshot:", error);
    res.status(500).send("Error taking screenshot");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  var environment = process.env.NODE_ENV;
  console.log("Express server running in " + environment + " mode");
});

// UTILITY FUNCTIONS
async function uploadImageToStrapi(imageBuffer, url) {
  const pathname = url.replace(/\/$/, ''); // Remove trailing slash if any
  const siteRoute = pathname.split('/').pop(); // Get the last part of the pathname
  console.log("Uploading image to Strapi:", siteRoute);

  const form = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  form.append("files", blob, `${siteRoute}.png`);

  const response = await axios.post("https://cms.divnectar.com/api/upload", form, {
    headers: {
      "Authorization": `Bearer ${process.env.STRAPI_API_KEY}`,
    },
  })


  return `https://cms.divnectar.com${response.data[0].url}`;
}
