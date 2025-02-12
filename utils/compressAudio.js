// utils/compressAudio.js
const ffmpeg = require('fluent-ffmpeg');

function compressAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate('128k')
      .on('error', (err) => {
        console.error("FFmpeg compression error:", err);
        reject(err);
      })
      .on('end', () => {
        console.log("Compression finished:", outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

module.exports = compressAudio;
