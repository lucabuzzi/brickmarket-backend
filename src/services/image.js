const sharp = require('sharp');
const { cloudinary, hasCloudinaryConfig } = require('./cloudinary');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Processes a buffer with sharp: resize max 1200px, webp format, 80% quality.
 */
async function processImage(buffer) {
  return await sharp(buffer)
    .resize(1200, 1200, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 80 })
    .toBuffer();
}

/**
 * Uploads a buffer to Cloudinary or saves it to disk depending on config.
 * Returns the final URL.
 */
async function uploadOrSaveProcessedImage(buffer, folder = 'brickmarket_listings') {
  const processedBuffer = await processImage(buffer);

  if (hasCloudinaryConfig) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          format: 'webp',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      uploadStream.end(processedBuffer);
    });
  } else {
    // Local disk fallback
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    const filename = `img-${Date.now()}-${crypto.randomInt(0, 1000000)}.webp`;
    const filePath = path.join(uploadDir, filename);
    await fs.promises.writeFile(filePath, processedBuffer);
    // Return relative path for normalization in frontend
    return `/uploads/${filename}`;
  }
}

module.exports = { processImage, uploadOrSaveProcessedImage };
