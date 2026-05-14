const { processImage } = require('../src/services/image');
const axios = require('axios');
const fs = require('fs');

async function test() {
  console.log('Fetching a large image...');
  const response = await axios.get('https://picsum.photos/seed/large/4000/3000', { responseType: 'arraybuffer' });
  const buffer = Buffer.from(response.data);
  console.log(`Original size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

  console.log('Processing image...');
  const startTime = Date.now();
  const processedBuffer = await processImage(buffer);
  const endTime = Date.now();
  
  console.log(`Processed size: ${(processedBuffer.length / 1024).toFixed(2)} KB`);
  console.log(`Processing time: ${endTime - startTime}ms`);
  
  if (processedBuffer.length < buffer.length / 10) {
    console.log('SUCCESS: Image size reduced by more than 90%!');
  } else {
    console.log('WARNING: Image size reduction was less than expected.');
  }

  // Check if it's WebP
  const sharp = require('sharp');
  const metadata = await sharp(processedBuffer).metadata();
  console.log(`Format: ${metadata.format}`);
  console.log(`Width: ${metadata.width}px`);

  if (metadata.format === 'webp' && metadata.width <= 1200) {
    console.log('SUCCESS: Format and dimensions are correct.');
  } else {
    console.log('FAILURE: Incorrect format or dimensions.');
  }
}

test().catch(console.error);
