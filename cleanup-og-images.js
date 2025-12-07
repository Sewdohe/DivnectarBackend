#!/usr/bin/env node
/**
 * Cleanup Script for OG Images
 *
 * This script clears all OG image entries from the MongoDB database.
 * Run this periodically to prevent the database from accumulating stale OG image data.
 *
 * Usage:
 *   node cleanup-og-images.js
 *
 * Or with environment files:
 *   NODE_ENV=development dotenvx run -f .env.development -- node cleanup-og-images.js
 *   NODE_ENV=production dotenvx run -f .env.production -- node cleanup-og-images.js
 */

require("@dotenvx/dotenvx").config();
const { MongoClient } = require("mongodb");
const { log } = require("./logger");

// MongoDB connection URI from environment
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Error: MONGO_URI environment variable is not set");
  process.exit(1);
}

async function cleanupOgImages() {
  const client = new MongoClient(MONGO_URI);

  try {
    log("Connecting to MongoDB...", "info");
    await client.connect();
    log("Connected successfully to MongoDB", "info");

    const db = client.db("divnectar");
    const collection = db.collection("og_images");

    // Get count before deletion
    const countBefore = await collection.countDocuments();
    log(`Found ${countBefore} OG image entries in database`, "info");

    if (countBefore === 0) {
      log("No OG images to clean up", "info");
      return;
    }

    // Delete all OG image entries
    const result = await collection.deleteMany({});
    log(`Deleted ${result.deletedCount} OG image entries`, "info");

    // Verify deletion
    const countAfter = await collection.countDocuments();
    log(`Remaining entries: ${countAfter}`, "info");

    if (countAfter === 0) {
      log("✓ OG images collection successfully cleaned!", "info");
    } else {
      log("⚠ Warning: Some entries may remain in the collection", "warn");
    }

  } catch (error) {
    log("Error during cleanup:", "error");
    console.error(error);
    process.exit(1);
  } finally {
    await client.close();
    log("MongoDB connection closed", "info");
  }
}

// Run the cleanup
log("=== OG Images Cleanup Script ===", "info");
log(`Environment: ${process.env.NODE_ENV || 'not set'}`, "info");

cleanupOgImages()
  .then(() => {
    log("Cleanup completed successfully", "info");
    process.exit(0);
  })
  .catch((error) => {
    log("Cleanup failed:", "error");
    console.error(error);
    process.exit(1);
  });
