// utils/stripExif.js
const sharp = require('sharp');

async function removeExif(inputPath, outputPath) {
  try {
    await sharp(inputPath)
      .withMetadata({ exif: {} }) // Write empty EXIF metadata
      .toFile(outputPath);
    return outputPath;
  } catch (error) {
    console.error("Error removing EXIF:", error);
    throw error;
  }
}

module.exports = removeExif;
