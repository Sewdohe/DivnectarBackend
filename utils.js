require("@dotenvx/dotenvx").config();


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

module.exports = {  uploadImageToStrapi, storeScreenshotUrl };