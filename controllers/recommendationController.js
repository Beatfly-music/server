    const pool = require('../utils/db');

    exports.getRecommendations = async (req, res) => {
      try {
        const userId = req.user.id;
        // Find artists from the user's favourite albums.
        const [favArtists] = await pool.query(
          `SELECT DISTINCT a.artist 
          FROM albums a 
          INNER JOIN favourite_albums fa ON a.id = fa.album_id 
          WHERE fa.user_id = ?`,
          [userId]
        );
        let artistList = favArtists.map(row => row.artist);
        
        let recommendations = [];
        if (artistList.length > 0) {
          // Recommend albums by these artists that the user hasn't favourited yet.
          const [rows] = await pool.query(
            `SELECT a.* FROM albums a 
            WHERE a.artist IN (?) AND a.id NOT IN 
              (SELECT album_id FROM favourite_albums WHERE user_id = ?) 
            ORDER BY created_at DESC LIMIT 10`,
            [artistList, userId]
          );
          recommendations = rows;
        }
        // If not enough recommendations, fill with recent albums.
        if (recommendations.length < 5) {
          const [recent] = await pool.query(
            `SELECT * FROM albums 
            WHERE id NOT IN (SELECT album_id FROM favourite_albums WHERE user_id = ?)
            ORDER BY created_at DESC LIMIT 10`,
            [userId]
          );
          // Merge recommendations (simple concatenation, avoiding duplicates).
          const recIds = new Set(recommendations.map(a => a.id));
          recent.forEach(album => {
            if (!recIds.has(album.id)) recommendations.push(album);
          });
        }
        res.json({ recommendations });
      } catch (error) {
        console.error("Recommendation error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    };
