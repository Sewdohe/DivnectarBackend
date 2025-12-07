require("@dotenvx/dotenvx").config();
const axios = require("axios");
var { client } = require("./mongoClient");
const { log } = require("./logger");

// UTILITY FUNCTIONS
async function uploadImageToWordPress(imageBuffer, url) {
  try {
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error("Image buffer is empty");
    }

    const pathname = url.replace(/\/$/, ''); // Remove trailing slash if any
    const urlParts = pathname.split('/').filter(part => part); // Remove empty parts
    const siteRoute = urlParts.pop() || 'home'; // Get the last part or use 'home' for root

    // Generate filename with timestamp to avoid duplicates
    const timestamp = Date.now();
    const filename = `og-${siteRoute}-${timestamp}.png`;

    log(`Uploading image to WordPress: ${filename}`, "info");

    const WORDPRESS_URL = process.env.WORDPRESS_URL;
    const WORDPRESS_USER = process.env.WORDPRESS_USER;
    const WORDPRESS_APP_PASSWORD = process.env.WORDPRESS_APP_PASSWORD;

    if (!WORDPRESS_URL || !WORDPRESS_USER || !WORDPRESS_APP_PASSWORD) {
      throw new Error("WordPress credentials not configured");
    }

    // WordPress REST API expects binary data directly
    const response = await axios.post(
      `${WORDPRESS_URL}/wp-json/wp/v2/media`,
      imageBuffer,
      {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Authorization": `Basic ${Buffer.from(`${WORDPRESS_USER}:${WORDPRESS_APP_PASSWORD}`).toString('base64')}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    if (response.data && response.data.source_url) {
      const uploadedUrl = response.data.source_url;
      log(`Upload complete. Image URL: ${uploadedUrl}`, "info");
      return uploadedUrl;
    } else {
      throw new Error("Unexpected response format from WordPress");
    }
  } catch (error) {
    log(`Error uploading image to WordPress: ${error.message}`, "error");
    if (error.response) {
      log(`WordPress API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`, "error");
    }
    throw new Error(`Failed to upload to WordPress: ${error.message}`);
  }
}
// function stores or updates the screenshot in the database with timestamp
async function storeScreenshotUrl(path, screenshotUrl) {
  try {
    const db = client.db('divnectar');
    const collection = db.collection('og_images');

    // Use updateOne with upsert to either insert new or update existing
    const result = await collection.updateOne(
      { path },
      {
        $set: {
          screenshotUrl,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        }
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      log("Stored new screenshot URL in MongoDB", "info");
    } else {
      log("Updated existing screenshot URL in MongoDB", "info");
    }

    return screenshotUrl;
  } catch (error) {
    log(`Error storing screenshot URL: ${error.message}`, "error");
    throw error;
  }
}

module.exports = {  uploadImageToWordPress, storeScreenshotUrl };