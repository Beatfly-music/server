// audioProcessing.js - Simplified high-quality audio processing
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const { v4: uuidv4 } = require('uuid');
const pool = require('../utils/db');

// Set ffmpeg and ffprobe paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

// Simple quality presets with better bitrates
const QUALITY_PRESETS = {
  high: { bitrate: '320k' },
  medium: { bitrate: '192k' },
  low: { bitrate: '128k' }
};

// Ensure cache directory exists
const ensureCacheDir = () => {
  const cacheDir = path.join(__dirname, '../cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
};

// Process uploaded audio with better quality
exports.processUploadedAudio = async (filePath, trackId) => {
  const cacheDir = ensureCacheDir();
  
  const promises = Object.entries(QUALITY_PRESETS).map(([quality, preset]) => {
    return new Promise((resolve, reject) => {
      const outputFile = path.join(cacheDir, `${trackId}_${quality}.mp3`);
      
      ffmpeg(filePath)
        .audioCodec('libmp3lame')
        .audioBitrate(preset.bitrate)
        .audioChannels(2)
        .audioFrequency(44100)
        .output(outputFile)
        .on('end', () => resolve(outputFile))
        .on('error', reject)
        .run();
    });
  });
  
  return Promise.all(promises);
};

// Stream audio with improved quality
exports.streamAudio = async (req, res) => {
  try {
    const trackId = req.params.trackId;
    const [rows] = await pool.query('SELECT file_path FROM tracks WHERE id = ?', [trackId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const filePath = rows[0].file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Log play event
    const userId = req.user?.id || req.session?.user_id;
    if (userId) {
      await pool.query(
        'INSERT INTO listens (user_id, track_id, listened_at) VALUES (?, ?, ?)',
        [userId, trackId, new Date()]
      );
    }

    // Get requested quality
    const requestedQuality = req.query.quality || 'high';
    const quality = QUALITY_PRESETS[requestedQuality] ? requestedQuality : 'high';
    
    const cacheDir = ensureCacheDir();
    const cacheFilePath = path.join(cacheDir, `${trackId}_${quality}.mp3`);

    // Check if pre-processed file exists
    if (fs.existsSync(cacheFilePath)) {
      const stat = fs.statSync(cacheFilePath);
      const range = req.headers.range;
      
      if (range) {
        // Handle range requests for seeking
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': (end - start) + 1,
          'Content-Type': 'audio/mpeg'
        });
        
        fs.createReadStream(cacheFilePath, { start, end }).pipe(res);
      } else {
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Content-Length': stat.size,
          'Accept-Ranges': 'bytes'
        });
        
        fs.createReadStream(cacheFilePath).pipe(res);
      }
    } else {
      // Process on the fly if not cached
      const preset = QUALITY_PRESETS[quality];
      
      res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
      
      ffmpeg(filePath)
        .audioCodec('libmp3lame')
        .audioBitrate(preset.bitrate)
        .audioChannels(2)
        .audioFrequency(44100)
        .format('mp3')
        .on('error', (err) => {
          console.error('Transcoding error:', err.message);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
          }
        })
        .pipe(res, { end: true });
      
      // Queue background processing
      setImmediate(() => {
        exports.processUploadedAudio(filePath, trackId)
          .catch(err => console.error(`Background processing failed: ${err.message}`));
      });
    }
  } catch (error) {
    console.error('Streaming error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Admin endpoint to reprocess audio
exports.reprocessAudio = async (req, res) => {
  try {
    const trackId = req.params.trackId;
    const [rows] = await pool.query('SELECT file_path FROM tracks WHERE id = ?', [trackId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const filePath = rows[0].file_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    
    await exports.processUploadedAudio(filePath, trackId);
    res.json({ success: true, message: 'Audio reprocessed successfully' });
    
  } catch (error) {
    console.error('Reprocessing error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};