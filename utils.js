require("@dotenvx/dotenvx").config();
const axios = require("axios");
var { client } = require("./mongoClient");
const { log } = require("./logger");

// UTILITY FUNCTIONS
async function uploadImageToStrapi(imageBuffer, url) {
  const pathname = url.replace(/\/$/, ''); // Remove trailing slash if any
  const siteRoute = pathname.split('/').pop(); // Get the last part of the pathname
  log("Uploading image to Strapi:" + siteRoute, "info");

  const form = new FormData();
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  form.append("files", blob, `${siteRoute}.png`);

  try {
    const response = await axios.post("https://cms.divnectar.com/api/upload", form, {
      headers: {
        "Authorization": `Bearer ${process.env.STRAPI_API_KEY}`,
      },
    })
    log("Process complete. Image URL:" + `https://cms.divnectar.com${response.data[0].url}`, "info");
    return `https://cms.divnectar.com${response.data[0].url}`;
  } catch (error) {
    log("Error uploading image to Strapi:", "error");
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
  log("Stored screenshot URL in MongoDB");
  return screenshotUrl;
}

module.exports = {  uploadImageToStrapi, storeScreenshotUrl };