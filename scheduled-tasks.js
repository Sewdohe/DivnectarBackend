/**
 * Scheduled Tasks
 *
 * This module handles all scheduled/cron tasks for the backend.
 * Currently includes:
 * - Monthly OG image cleanup
 */

const cron = require('node-cron');
const { log } = require('./logger');
const { client } = require('./mongoClient');

/**
 * Cleanup OG images from MongoDB
 * Runs automatically once per month
 */
async function cleanupOgImages() {
  try {
    log("Running scheduled OG images cleanup...", "info");

    const db = client.db("divnectar");
    const collection = db.collection("og_images");

    // Get count before deletion
    const countBefore = await collection.countDocuments();
    log(`Found ${countBefore} OG image entries`, "info");

    if (countBefore === 0) {
      log("No OG images to clean up", "info");
      return;
    }

    // Delete all OG image entries
    const result = await collection.deleteMany({});
    log(`Deleted ${result.deletedCount} OG image entries`, "info");

    // Verify deletion
    const countAfter = await collection.countDocuments();

    if (countAfter === 0) {
      log("✓ OG images collection successfully cleaned!", "info");
    } else {
      log(`⚠ Warning: ${countAfter} entries remain in the collection`, "warn");
    }

  } catch (error) {
    log("Error during OG images cleanup:", "error");
    console.error(error);
  }
}

/**
 * Initialize all scheduled tasks
 */
function initializeScheduledTasks() {
  log("Initializing scheduled tasks...", "info");

  // Schedule OG images cleanup to run on the 1st of every month at 2:00 AM
  // Cron format: minute hour day-of-month month day-of-week
  cron.schedule('0 2 1 * *', () => {
    log("=== Scheduled Task: Monthly OG Images Cleanup ===", "info");
    cleanupOgImages();
  });

  log("✓ Scheduled tasks initialized:", "info");
  log("  - OG images cleanup: 1st of every month at 2:00 AM", "info");
}

module.exports = { initializeScheduledTasks, cleanupOgImages };
