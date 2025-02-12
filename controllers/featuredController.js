const pool = require('../utils/db');

exports.getFeaturedAlbums = async (req, res) => {
  try {
    // Fetch top 10 albums with the highest listens.
    const [albums] = await pool.query("SELECT * FROM albums ORDER BY listens DESC LIMIT 10");
    res.json({ featured: albums });
  } catch (error) {
    console.error("Error fetching featured albums:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
