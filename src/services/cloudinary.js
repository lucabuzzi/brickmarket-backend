const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const hasCloudinaryConfig = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

let upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
let secureUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

if (hasCloudinaryConfig) {
  console.log('[Cloudinary] Configured — memory storage active for sharp processing.');
} else {
  console.warn('[Cloudinary] MISSING env vars — using memory storage for disk fallback via sharp.');
}

async function deleteSecureAsset(public_id) {
  if (!public_id || !hasCloudinaryConfig) return;
  await cloudinary.uploader.destroy(public_id, { type: 'private', invalidate: true });
}

module.exports = { cloudinary, upload, secureUpload, deleteSecureAsset, hasCloudinaryConfig };