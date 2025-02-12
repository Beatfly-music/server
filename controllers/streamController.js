      // controllers/streamingController.js

      const pool = require('../utils/db');
      const fs = require('fs');
      const path = require('path');

      exports.streamAudio = async (req, res) => {
        try {
          const trackId = req.params.trackId;

          // 1) Look up the track in DB to get the file path.
          const [rows] = await pool.query('SELECT file_path FROM tracks WHERE id = ?', [trackId]);
          if (rows.length === 0) {
            return res.status(404).json({ error: 'Track not found in the database.' });
          }   

          const filePath = rows[0].file_path;
          if (!filePath) {
            return res.status(404).json({ error: 'No file path found for this track.' });
          }

          // 2) Check that the file actually exists on disk.
          if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Audio file does not exist on the server.' });
          }

          // 3) Get file size (total bytes).
          const stat = fs.statSync(filePath);
          const total = stat.size;

          // 4) Check for a Range header.
          const range = req.headers.range;
          if (!range) {
            // No Range header => stream the entire file with a 200 status.
            res.writeHead(200, {
              'Content-Type': 'audio/mpeg',
              'Content-Length': total,
            });
            fs.createReadStream(filePath).pipe(res);
          } else {
            // Range header => partial content streaming (206 status).
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            // If client didn’t specify an end, use the file’s last byte.
            const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
            const chunkSize = end - start + 1;

            // 206 indicates partial content.
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${total}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': 'audio/mpeg',
            });

            fs.createReadStream(filePath, { start, end }).pipe(res);
          }
        } catch (error) {
          console.error('Error streaming audio:', error);
          res.status(500).json({ error: 'Internal server error', details: error.message });
        }
      };
