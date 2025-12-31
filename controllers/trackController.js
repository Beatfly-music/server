const pool = require('../utils/db');

function buildImageUrl(req, filePath) {
  const relative = filePath.replace(/^uploads[\/\\]/, '');
  return `${req.protocol}://${req.get('host')}/xrpc/images/${relative}`;
}

exports.getTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const [tracks] = await pool.query(
      `SELECT 
        t.*,
        COALESCE(t.track_image, a.album_art) AS track_image,
        a.user_id AS album_artist_id,
        t_artist.id AS track_artist_id,
        COALESCE(t_artist.id, a.user_id) AS artist_id,
        COALESCE(t.artist, a.artist) AS artist_name
       FROM tracks t 
       LEFT JOIN albums a ON t.album_id = a.id 
       LEFT JOIN users t_artist ON t.artist = t_artist.username
       WHERE t.id = ?`,
      [trackId]
    );

    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ error: "Track not found" });
    }

    let track = tracks[0];
    
    // Convert image path to URL if exists
    if (track.track_image) {
      track.track_image = buildImageUrl(req, track.track_image);
    }

    // Restructure the response to include artist information
    const response = {
      ...track,
      artistId: track.artist_id, // Use the COALESCE result
      artist: track.artist_name,
    };

    // Remove the redundant fields from the response
    delete response.artist_id;
    delete response.artist_name;
    delete response.album_artist_id;
    delete response.track_artist_id;

    res.json(response);
  } catch (error) {
    console.error("Error fetching track:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};