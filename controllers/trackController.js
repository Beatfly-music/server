const pool = require('../utils/db');

function buildImageUrl(req, filePath) {
  const relative = filePath.replace(/^uploads[\/\\]/, '');
  return `${req.protocol}://${req.get('host')}/xrpc/images/${relative}`;
}

exports.getTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const [tracks] = await pool.query(
      `SELECT t.*, COALESCE(t.track_image, a.album_art) AS track_image
       FROM tracks t 
       LEFT JOIN albums a ON t.album_id = a.id 
       WHERE t.id = ?`,
      [trackId]
    );
    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ error: "Track not found" });
    }
    let track = tracks[0];
    if (track.track_image) {
      track.track_image = buildImageUrl(req, track.track_image);
    }
    res.json(track);
  } catch (error) {
    console.error("Error fetching track:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
