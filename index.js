const express = require("express");
const axios = require("axios");
require("@dotenvx/dotenvx").config();
const cors = require("cors");
const { MongoClient } = require("mongodb");
const { Blob } = require("buffer");
var clc = require("cli-color");

const app = express();
const PORT = 4477;

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

console.log(clc.blue.bold("connecting to Divnectar MongoDB...\n"));

async function connectToMongoDB() {
  try {
    await client.connect();
    console.log(clc.green.bold("Connected to MongoDB"));
  } catch (err) {
    console.error(clc.red(err));
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
console.log(clc.blue.bold('Enabled cors for divnectar.com\n'));

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
  console.log(clc.yellow("request for screenshot of " + req.query.url));
  const TOKEN = process.env.BROWSERLESS_TOKEN;
  const url = `https://browserless.divnectar.com/screenshot?token=${TOKEN}`;
  const headers = {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
  };
  const data = {
    url: req.query.url,
    options: {
      fullPage: false,
      type: "png",
    },
  };

  try {
    const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });
    if (response.status !== 200 & response.data) {
      console.log(clc.green("Screenshot taken successfully, recieved buffer"));
    }
    const imageBuffer = response.data
    const screenshotUrl = await uploadImageToStrapi(imageBuffer, req.query.url);
    // the upload function returns the URL sent to the client.
    res.send(await storeScreenshotUrl(req.query.url, screenshotUrl));
  } catch (error) {
    console.log("Error taking screenshot:", error);
    res.status(500).send("Error taking screenshot");
  }
});

app.get("/api/check-og-image", async (req, res) => {
  console.log(clc.yellow("Checking for existing OG image:" + clc.blue(req.query.path)));
  const path = "https://divnectar.com" + req.query.path;
  if (!path) return res.status(400).send("Missing path");

  try {
    const db = client.db('divnectar');
    const collection = db.collection('og_images');
    const existingImage = await collection.findOne({ path });

    if (existingImage) {
      console.log(clc.green("OG image exists in MongoDB"));
      return res.json({ exists: true, url: existingImage.screenshotUrl });
    } else {
      console.log(clc.red("OG image does not exist in MongoDB"));
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking OG image:", error);
    res.status(500).send("Error checking OG image");
  }
});

app.listen(PORT, () => {
  console.log(clc.yellow.bold(`Listening for requests on port http://localhost:${PORT}\n`));
  var environment = process.env.NODE_ENV;
  environment = environment == 'development' ? clc.magenta.bold.underline('development') : clc.green.bold.underline('production')
  console.log(clc.yellow("Express server running in ") + environment + clc.yellow(" mode\n"));
});

// UTILITY FUNCTIONS
async function uploadImageToStrapi(imageBuffer, url) {
  const pathname = url.replace(/\/$/, ''); // Remove trailing slash if any
  const siteRoute = pathname.split('/').pop(); // Get the last part of the pathname
  console.log(clc.yellow("Uploading image to Strapi:" + siteRoute));

  const form = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  form.append("files", blob, `${siteRoute}.png`);

  try {
    const response = await axios.post("https://cms.divnectar.com/api/upload", form, {
      headers: {
        "Authorization": `Bearer ${process.env.STRAPI_API_KEY}`,
      },
    })
    console.log(clc.yellow("Process complete. Image URL:"), clc.blue(`https://cms.divnectar.com${response.data[0].url}`));
    return `https://cms.divnectar.com${response.data[0].url}`;
  } catch (error) {
    console.log(clc.red.bold("Error uploading image to Strapi:", error));
    return "Error uploading image to Strapi";
  }
}

// function stores the screenshot in the database, or checks if one already exists
// and returns the URL if so.
async function storeScreenshotUrl(path, screenshotUrl) {
  const db = client.db('divnectar');
  const collection = db.collection('og_images');

  const existingImage = await collection.findOne({ path });
  if (existingImage) {
    return existingImage.screenshotUrl;
  }

  await collection.insertOne({ path, screenshotUrl });
  console.log(clc.green("Stored screenshot URL in MongoDB"));
  return screenshotUrl;
}
