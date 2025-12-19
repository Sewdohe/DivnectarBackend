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

  try {
    // Check MongoDB first to avoid unnecessary regeneration
    const db = client.db('divnectar');
    const collection = db.collection('og_images');
    const existingImage = await collection.findOne({ path: targetUrl });

    // If image exists and is less than 30 days old, return it
    if (existingImage && existingImage.createdAt) {
      const daysSinceCreation = (Date.now() - new Date(existingImage.createdAt).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceCreation < 30) {
        log(`Using existing OG image (${Math.floor(daysSinceCreation)} days old)`, "info");
        return res.send(existingImage.screenshotUrl);
      } else {
        log(`OG image is stale (${Math.floor(daysSinceCreation)} days old), regenerating...`, "info");
      }
    }

    // Generate new screenshot
    const TOKEN = process.env.BROWSERLESS_TOKEN;
    const browserlessUrl = `https://browserless.divnectar.com/screenshot?token=${TOKEN}`;

    const headers = {
      "Cache-Control": "no-cache",
      "Content-Type": "application/json",
    };

    const data = {
      url: targetUrl,
      options: {
        type: "png",
      },
      gotoOptions: {
        waitUntil: "networkidle0",
      },
      viewport: {
        width: 1200,
        height: 630,
      },
    };

    log("Sending screenshot request to browserless...", "info");
    const response = await axios.post(browserlessUrl, data, {
      headers,
      responseType: 'arraybuffer',
      timeout: 35000
    });

    if (response.status === 200 && response.data) {
      log("Screenshot taken successfully, received buffer", "info");
      const imageBuffer = response.data;

      try {
        const screenshotUrl = await uploadImageToStrapi(imageBuffer, targetUrl);

        // Store or update in MongoDB with timestamp
        const storedUrl = await storeScreenshotUrl(targetUrl, screenshotUrl);
        res.send(storedUrl);
      } catch (uploadError) {
        log("Failed to upload to Strapi: " + uploadError.message, "error");
        return res.status(500).send("Failed to upload screenshot");
      }
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
  log("Checking for existing OG image:" + req.query.path, "info");
  const path = "https://divnectar.com" + req.query.path;
  if (!path) return res.status(400).send("Missing path");

  try {
    const db = client.db('divnectar');
    const collection = db.collection('og_images');
    const existingImage = await collection.findOne({ path });

    // Set cache headers - cache for 5 minutes
    res.set('Cache-Control', 'public, max-age=300, s-maxage=300');

    if (existingImage) {
      // Check if image is stale (older than 30 days)
      if (existingImage.createdAt) {
        const daysSinceCreation = (Date.now() - new Date(existingImage.createdAt).getTime()) / (1000 * 60 * 60 * 24);

        if (daysSinceCreation >= 30) {
          log(`OG image exists but is stale (${Math.floor(daysSinceCreation)} days old)`, "info");
          return res.json({ exists: false, reason: "stale" });
        }
      }

      log(`OG image exists in MongoDB and is fresh`, "info");
      return res.json({ exists: true, url: existingImage.screenshotUrl });
    } else {
      log("OG image does not exist in MongoDB");
      return res.json({ exists: false });
    }
  } catch (error) {
    console.error("Error checking OG image:", error);
    log("Error checking OG image: " + error.message, "error");
    res.status(500).send("Error checking OG image");
  }
});

module.exports = router;
