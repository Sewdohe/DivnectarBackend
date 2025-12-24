const express = require('express');
const SftpClient = require('ssh2-sftp-client');
const { log } = require('./logger');
const router = express.Router();

// SFTP configuration from environment
const sftpConfig = {
  host: process.env.SFTP_HOST,
  port: process.env.SFTP_PORT || 22,
  username: process.env.SFTP_USERNAME,
  password: process.env.SFTP_PASSWORD,
  readyTimeout: 10000,
};

// Connection pool (reuse connection)
let sftpClient = null;

async function getSftpConnection() {
  if (!sftpClient || !sftpClient.sftp) {
    sftpClient = new SftpClient();
    await sftpClient.connect(sftpConfig);
    log('SFTP connection established', 'info');
  }
  return sftpClient;
}

// Validate filename (security)
function validateFilename(filename) {
  const safePattern = /^[a-zA-Z0-9_-]+\.png$/;
  if (!safePattern.test(filename)) {
    throw new Error('Invalid filename');
  }
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('Path traversal detected');
  }
  return filename;
}

// GET /api/photos/list?limit=20&offset=0
router.get('/list', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    log(`Fetching photo list (limit: ${limit}, offset: ${offset})`, 'info');

    const sftp = await getSftpConnection();
    const remotePath = process.env.SFTP_PHOTOS_PATH || '/Exposures';

    // List directory
    const fileList = await sftp.list(remotePath);

    // Filter PNG files
    const pngFiles = fileList
      .filter(file => file.type === '-' && file.name.endsWith('.png'))
      .map(file => ({
        name: file.name,
        size: file.size,
        modified: file.modifyTime,
      }))
      .sort((a, b) => b.modified - a.modified); // Newest first

    // Apply pagination
    const total = pngFiles.length;
    const paginatedFiles = pngFiles.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    log(`Returning ${paginatedFiles.length} photos (total: ${total})`, 'info');

    res.json({
      files: paginatedFiles,
      total,
      hasMore,
    });
  } catch (error) {
    log(`Error listing photos: ${error.message}`, 'error');
    res.status(500).json({ error: 'Failed to list photos' });
  }
});

// GET /api/photos/image/:filename
router.get('/image/:filename', async (req, res) => {
  try {
    const filename = validateFilename(req.params.filename);
    const sftp = await getSftpConnection();
    const remotePath = process.env.SFTP_PHOTOS_PATH || '/Exposures';
    const fullPath = `${remotePath}/${filename}`;

    log(`Streaming image: ${filename}`, 'info');

    // Set headers
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Get file as buffer and send
    const buffer = await sftp.get(fullPath);
    res.send(buffer);
  } catch (error) {
    log(`Error fetching image: ${error.message}`, 'error');
    res.status(404).send('Image not found');
  }
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  if (sftpClient) {
    await sftpClient.end();
    log('SFTP connection closed', 'info');
  }
});

module.exports = router;
