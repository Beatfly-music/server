      // controllers/streamingController.js

      const pool = require('../utils/db');
      const fs = require('fs');
      const path = require('path');

      exports.streamAudio = async (req, res) => {
        try {
          const trackId = req.params.trackId;
          const [rows] = await pool.query('SELECT file_path FROM tracks WHERE id = ?', [trackId]);
          
          if (rows.length === 0) {
            return res.status(404).json({ error: 'Track not found' });
          }
      
          const filePath = rows[0].file_path;
          const stat = fs.statSync(filePath);
          const fileSize = stat.size;
          const range = req.headers.range;
      
          if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(filePath, { start, end });
            
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunksize,
              'Content-Type': 'audio/mpeg',
            });
            
            file.pipe(res);
          } else {
            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': 'audio/mpeg',
            });
            
            fs.createReadStream(filePath).pipe(res);
          }
        } catch (error) {
          console.error('Streaming error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      };