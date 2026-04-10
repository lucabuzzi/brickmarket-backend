const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Prende le chiavi dal file .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configura lo storage: dove e come salvare le foto
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'brickmarket_listings', // Nome della cartella su Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }] // Ridimensiona se troppo grandi
  },
});

const upload = multer({ storage: storage });

module.exports = { cloudinary, upload };