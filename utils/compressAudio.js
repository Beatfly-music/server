const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');

// Set the path to the ffmpeg executable
ffmpeg.setFfmpegPath(ffmpegStatic);

/**
 * Compress audio by automatically determining the output format based on the file extension.
 *
 * @param {string} inputPath - The path to the input audio file.
 * @param {string} outputPath - The path where the output file will be saved.
 * @returns {Promise<string>} - A promise that resolves with the output path.
 */
function compressAudio(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Determine the format from the output file extension
    let ext = path.extname(outputPath).toLowerCase().replace('.', '');
    if (!ext) {
      console.warn('No extension found on outputPath, defaulting to mp3');
      ext = 'mp3';
    }
    
    let command = ffmpeg(inputPath);

    // Adjust FFmpeg settings based on the file extension
    switch (ext) {
      case 'mp3':
        command = command
          .audioCodec('libmp3lame')
          .audioBitrate('96k')
          .audioFrequency(44100) // Standard for MP3
          .audioChannels(2);
        break;
      case 'opus':
        command = command
          .audioCodec('libopus')
          .audioBitrate('96k')
          .audioFrequency(32000)
          .audioChannels(2);
        break;
      case 'ogg':
        command = command
          .audioCodec('libvorbis')
          .audioBitrate('96k')
          .audioFrequency(44100)
          .audioChannels(2);
        break;
      default:
        // Default to MP3 settings if the extension isn't recognized.
        console.warn(`Unrecognized format "${ext}", defaulting to MP3.`);
        command = command
          .audioCodec('libmp3lame')
          .audioBitrate('96k')
          .audioFrequency(44100)
          .audioChannels(2);
        ext = 'mp3';
    }

    // Set the container format based on the file extension
    command = command.toFormat(ext);

    command
      .on('error', (err) => {
        console.error('FFmpeg compression error:', err);
        reject(err);
      })
      .on('end', () => {
        console.log('Compression finished:', outputPath);
        resolve(outputPath);
      })
      .save(outputPath);
  });
}

module.exports = compressAudio;
