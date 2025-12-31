// controllers/recommendationController.js

const pool = require('../utils/db');

exports.getRecommendations = async (req, res) => {
  try {
    // Retrieve current user ID from req.user or req.session.
    const userId = (req.user && req.user.id) || (req.session && req.session.user_id);
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // ------------------------------------------------------
    // 1. Gather user interactions concurrently.
    // ------------------------------------------------------
    const [
      listenedRows,
      favTrackRows,
      favArtistRows
    ] = await Promise.all([
      pool.query('SELECT DISTINCT track_id FROM listens WHERE user_id = ?', [userId]),
      pool.query('SELECT DISTINCT track_id FROM favourite_tracks WHERE user_id = ?', [userId]),
      pool.query('SELECT DISTINCT artist_id FROM favourite_artists WHERE user_id = ?', [userId])
    ]);

    const listenedTrackIds = listenedRows[0].map(row => row.track_id);
    const favTrackIds = favTrackRows[0].map(row => row.track_id);
    const userTrackIdsSet = new Set([...listenedTrackIds, ...favTrackIds]);
    const userTrackIds = Array.from(userTrackIdsSet);

    // Get favorite artist names if any.
    let favArtistNames = [];
    if (favArtistRows[0].length) {
      const favArtistIds = favArtistRows[0].map(row => row.artist_id);
      const [artistProfiles] = await pool.query(
        'SELECT stage_name FROM artist_profiles WHERE user_id IN (?)',
        [favArtistIds]
      );
      favArtistNames = artistProfiles.map(row => row.stage_name);
    }

    // ------------------------------------------------------
    // 2. Identify similar users.
    // ------------------------------------------------------
    // Run the UNION query to fetch similar users concurrently.
    const [similarUserRows] = await pool.query(
      `SELECT DISTINCT user_id FROM (
         SELECT user_id FROM listens WHERE track_id IN (?)
         UNION
         SELECT user_id FROM favourite_tracks WHERE track_id IN (?)
       ) AS combined
       WHERE user_id <> ?`,
      [
        userTrackIds.length ? userTrackIds : [0],
        userTrackIds.length ? userTrackIds : [0],
        userId
      ]
    );
    const similarUserIds = similarUserRows.map(row => row.user_id);

    // If no similar users are found, immediately use the fallback.
    if (!similarUserIds.length) {
      const fallback = await fallbackRecommendations(userTrackIds);
      return res.status(200).json(fallback);
    }

    // ------------------------------------------------------
    // 3. Query candidate interactions concurrently.
    // ------------------------------------------------------
    const [candidateListenRows, candidateFavRows] = await Promise.all([
      pool.query(
        `SELECT track_id, COUNT(*) AS listenCount
         FROM listens
         WHERE user_id IN (?)
           AND track_id NOT IN (?)
         GROUP BY track_id`,
        [
          similarUserIds,
          userTrackIds.length ? userTrackIds : [0]
        ]
      ),
      pool.query(
        `SELECT track_id, COUNT(*) AS favCount
         FROM favourite_tracks
         WHERE user_id IN (?)
           AND track_id NOT IN (?)
         GROUP BY track_id`,
        [
          similarUserIds,
          userTrackIds.length ? userTrackIds : [0]
        ]
      )
    ]);
    
    // ------------------------------------------------------
    // 4. Combine candidate scores.
    // ------------------------------------------------------
    const candidateScores = {};
    candidateListenRows[0].forEach(row => {
      candidateScores[row.track_id] = (candidateScores[row.track_id] || 0) + parseInt(row.listenCount, 10);
    });
    candidateFavRows[0].forEach(row => {
      candidateScores[row.track_id] = (candidateScores[row.track_id] || 0) + (parseInt(row.favCount, 10) * 2);
    });

    // ------------------------------------------------------
    // 5. Retrieve candidate track details.
    // ------------------------------------------------------
    const candidateTrackIds = Object.keys(candidateScores);
    let recommendations = [];
    if (candidateTrackIds.length) {
      const [tracks] = await pool.query(
        `SELECT t.*, a.title AS album_title, a.album_art
         FROM tracks t
         LEFT JOIN albums a ON t.album_id = a.id
         WHERE t.id IN (?)`,
        [candidateTrackIds]
      );
      // Add bonus if track artist is among favorite artists.
      tracks.forEach(track => {
        if (favArtistNames.includes(track.artist)) {
          candidateScores[track.id] += 5; // bonus points
        }
      });
      recommendations = tracks.map(track => ({
        ...track,
        score: candidateScores[track.id]
      }));
      recommendations.sort((a, b) => b.score - a.score);
    }

    // ------------------------------------------------------
    // 6. Fallback: if no recommendations, get random recommendations.
    // ------------------------------------------------------
    if (!recommendations.length) {
      const fallback = await fallbackRecommendations(userTrackIds);
      return res.status(200).json(fallback);
    }

    res.status(200).json({ recommendations });
  } catch (error) {
    console.error('Recommendation error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
};

// Helper function: Fallback to random recommendations (tracks & albums)
const fallbackRecommendations = async (userTrackIds) => {
  try {
    // Random tracks not in user's interactions.
    const [randomTracks] = await pool.query(
      `SELECT t.*, a.title AS album_title, a.album_art
       FROM tracks t
       LEFT JOIN albums a ON t.album_id = a.id
       WHERE t.id NOT IN (?)
       ORDER BY RAND() LIMIT 10`,
      [userTrackIds.length ? userTrackIds : [0]]
    );
    // Random albums not favorited by user.
    const [randomAlbums] = await pool.query(
      `SELECT * FROM albums
       WHERE id NOT IN (
         SELECT album_id FROM favourite_albums WHERE user_id = ?
       )
       ORDER BY RAND() LIMIT 5`,
      [userTrackIds.length ? userTrackIds[0] : 0] // dummy value if none exists
    );
    return { tracks: randomTracks, albums: randomAlbums };
  } catch (error) {
    console.error('Fallback recommendation error:', error);
    return { tracks: [], albums: [] };
  }
};
