require("@dotenvx/dotenvx").config();
const axios = require("axios");
var { client } = require("./mongoClient");
const { log } = require("./logger");

// UTILITY FUNCTIONS
async function uploadImageToStrapi(imageBuffer, url) {
  try {
    const pathname = url.replace(/\/$/, ''); // Remove trailing slash if any
    const urlParts = pathname.split('/').filter(part => part); // Remove empty parts
    const siteRoute = urlParts.pop() || 'home'; // Get the last part or use 'home' for root

    // Generate filename with timestamp to avoid duplicates
    const timestamp = Date.now();
    const filename = `og-${siteRoute}-${timestamp}.png`;

    log(`Uploading image to Strapi: ${filename}`, "info");

    const form = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/png' });
    form.append("files", blob, filename);

    const response = await axios.post("https://cms.divnectar.com/api/upload", form, {
      headers: {
        "Authorization": `Bearer ${process.env.STRAPI_API_KEY}`,
      },
    });

    if (response.data && response.data[0] && response.data[0].url) {
      const uploadedUrl = `https://cms.divnectar.com${response.data[0].url}`;
      log(`Upload complete. Image URL: ${uploadedUrl}`, "info");
      return uploadedUrl;
    } else {
      log("Unexpected response format from Strapi", "error");
      return "Error: Unexpected response format";
    }
  } catch (error) {
    log(`Error uploading image to Strapi: ${error.message}`, "error");
    console.error(error);
    return `Error uploading image to Strapi: ${error.message}`;
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
  log("Stored screenshot URL in MongoDB");
  return screenshotUrl;
}

module.exports = {  uploadImageToStrapi, storeScreenshotUrl };