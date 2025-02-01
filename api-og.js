const express = require("express");
const router = express.Router();
const axios = require("axios");
var clc = require("cli-color");
var { uploadImageToStrapi, storeScreenshotUrl } = require("./utils");

router.get("/og-image", async (req, res) => {
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

router.get("/check-og-image", async (req, res) => {
  //TODO: check timestamp on image and re-generate if older than 24 hours
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

module.exports = router;
