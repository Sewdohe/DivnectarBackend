const express = require("express");
const router = express.Router();
const axios = require("axios");
const {log} = require("./logger");
var { uploadImageToStrapi, storeScreenshotUrl } = require("./utils");
var { client } = require("./mongoClient");

router.get("/og-image", async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    log("Missing URL parameter", "error");
    return res.status(400).send("Missing URL parameter");
  }

  log("Request for screenshot of: " + targetUrl, "info");

  const TOKEN = process.env.BROWSERLESS_TOKEN;
  const browserlessUrl = `https://browserless.divnectar.com/screenshot?token=${TOKEN}`;

  const headers = {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
  };

  const data = {
    url: targetUrl,
    options: {
      fullPage: false,
      type: "png",
    },
    gotoOptions: {
      waitUntil: "networkidle2", // Wait until network is idle
      timeout: 30000, // 30 second timeout
    },
    viewport: {
      width: 1200,
      height: 630, // Standard OG image size
      deviceScaleFactor: 2, // Higher quality
    },
    // Set dark mode preference
    emulateMediaFeatures: [
      {
        name: "prefers-color-scheme",
        value: "dark"
      }
    ],
    waitFor: 2000, // Additional 2 second wait for content to settle
  };

  try {
    log("Sending screenshot request to browserless...", "info");
    const response = await axios.post(browserlessUrl, data, {
      headers,
      responseType: 'arraybuffer',
      timeout: 35000 // Overall request timeout
    });

    if (response.status === 200 && response.data) {
      log("Screenshot taken successfully, received buffer", "info");
      const imageBuffer = response.data;
      const screenshotUrl = await uploadImageToStrapi(imageBuffer, targetUrl);

      if (screenshotUrl.includes("Error")) {
        log("Failed to upload to Strapi", "error");
        return res.status(500).send("Failed to upload screenshot");
      }

      const storedUrl = await storeScreenshotUrl(targetUrl, screenshotUrl);
      res.send(storedUrl);
    } else {
      log("Unexpected response from browserless: " + response.status, "error");
      res.status(500).send("Failed to take screenshot");
    }
  } catch (error) {
    log("Error taking screenshot: " + error.message, "error");
    console.error(error);
    res.status(500).send("Error taking screenshot");
  }
});

router.get("/check-og-image", async (req, res) => {
  //TODO: check timestamp on image and re-generate if older than 24 hours
  log("Checking for existing OG image:" + req.query.path, "info");
  const path = "https://divnectar.com" + req.query.path;
  if (!path) return res.status(400).send("Missing path");

  try {
    const db = client.db('divnectar');
    const collection = db.collection('og_images');
    const existingImage = await collection.findOne({ path });

    if (existingImage) {
      log("OG image exists in MongoDB");
      return res.json({ exists: true, url: existingImage.screenshotUrl });
    } else {
      log("OG image does not exist in MongoDB");
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking OG image:", error);
    res.status(500).send("Error checking OG image");
  }
});

module.exports = router;
