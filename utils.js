require("@dotenvx/dotenvx").config();
const axios = require("axios");
const FormData = require("form-data");
var { client } = require("./mongoClient");
const { log } = require("./logger");

// UTILITY FUNCTIONS
async function uploadImageToStrapi(imageBuffer, url) {
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

    log(`Uploading image to Strapi: ${filename}`, "info");

    const STRAPI_URL = process.env.STRAPI_URL;
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

    if (!STRAPI_URL || !STRAPI_API_TOKEN) {
      throw new Error("Strapi credentials not configured");
    }

    // Create form data for Strapi upload
    const formData = new FormData();
    formData.append('files', imageBuffer, {
      filename: filename,
      contentType: 'image/png',
    });
    // Specify path to upload to og-images folder
    formData.append('path', 'og-images');

    log(`Attempting upload to ${STRAPI_URL}/api/upload with path: og-images`, "info");

    const response = await axios.post(
      `${STRAPI_URL}/api/upload`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          "Authorization": `Bearer ${STRAPI_API_TOKEN}`,
        },
        timeout: 30000, // 30 second timeout
      }
    );

    log(`Upload response status: ${response.status}`, "info");
    log(`Upload response data: ${JSON.stringify(response.data)}`, "info");

    if (response.data && response.data[0] && response.data[0].url) {
      // Strapi returns relative URLs, need to prepend STRAPI_URL if not absolute
      let uploadedUrl = response.data[0].url;
      if (!uploadedUrl.startsWith('http')) {
        uploadedUrl = `${STRAPI_URL}${uploadedUrl}`;
      }
      log(`Upload complete. Image URL: ${uploadedUrl}`, "info");
      return uploadedUrl;
    } else {
      log(`Unexpected response format. Response: ${JSON.stringify(response.data)}`, "error");
      throw new Error("Unexpected response format from Strapi");
    }
  } catch (error) {
    log(`Error uploading image to Strapi: ${error.message}`, "error");
    if (error.response) {
      log(`Strapi API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`, "error");
    }
    throw new Error(`Failed to upload to Strapi: ${error.message}`);
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

module.exports = { uploadImageToStrapi, storeScreenshotUrl };