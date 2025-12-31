const pool = require('../utils/db');
const { savePlaybackPosition, getPlaybackPosition, formatPlaybackState } = require('../utils/playbackState');

const buildImageUrl = (req, filePath) => {
  if (!filePath) return null;
  const relative = filePath.replace(/^uploads[\\/]/, '');
  return `${req.protocol}://${req.get('host')}/xrpc/images/${relative}`;
};

const ensureSettingsRow = async (userId) => {
  await pool.query(
    `INSERT INTO user_settings (user_id) VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId]
  );
};

const buildYearInReview = async (userId, year, req) => {
  const [[listenSummary]] = await pool.query(
    `SELECT 
       COUNT(*) AS totalListens,
       COUNT(DISTINCT track_id) AS uniqueTracks,
       MIN(listened_at) AS firstListen,
       MAX(listened_at) AS lastListen
     FROM listens
     WHERE user_id = ? AND YEAR(listened_at) = ?`,
    [userId, year]
  );

  const [topTracksRaw] = await pool.query(
    `SELECT 
       l.track_id,
       COUNT(*) AS listenCount,
       t.title,
       t.artist,
       COALESCE(t.track_image, a.album_art) AS track_image,
       a.title AS album_title
     FROM listens l
     JOIN tracks t ON l.track_id = t.id
     LEFT JOIN albums a ON t.album_id = a.id
     WHERE l.user_id = ? AND YEAR(l.listened_at) = ?
     GROUP BY l.track_id
     ORDER BY listenCount DESC
     LIMIT 10`,
    [userId, year]
  );

  const topTracks = topTracksRaw.map(track => ({
    trackId: track.track_id,
    title: track.title,
    artist: track.artist,
    album: track.album_title,
    listenCount: Number(track.listenCount),
    track_image: buildImageUrl(req, track.track_image)
  }));

  const [topArtists] = await pool.query(
    `SELECT 
       COALESCE(t.artist, a.artist) AS artist,
       COUNT(*) AS listenCount
     FROM listens l
     JOIN tracks t ON l.track_id = t.id
     LEFT JOIN albums a ON t.album_id = a.id
     WHERE l.user_id = ? AND YEAR(l.listened_at) = ?
     GROUP BY artist
     HAVING artist IS NOT NULL
     ORDER BY listenCount DESC
     LIMIT 5`,
    [userId, year]
  );

  const [favouriteAdds] = await pool.query(
    `SELECT 
       ft.track_id,
       t.title,
       t.artist,
       COALESCE(t.track_image, a.album_art) AS track_image,
       ft.created_at
     FROM favourite_tracks ft
     JOIN tracks t ON ft.track_id = t.id
     LEFT JOIN albums a ON t.album_id = a.id
     WHERE ft.user_id = ? AND YEAR(ft.created_at) = ?
     ORDER BY ft.created_at DESC
     LIMIT 10`,
    [userId, year]
  );

  const favouritesAdded = favouriteAdds.map(row => ({
    trackId: row.track_id,
    title: row.title,
    artist: row.artist,
    addedAt: row.created_at,
    track_image: buildImageUrl(req, row.track_image)
  }));

  const [dislikes] = await pool.query(
    `SELECT 
       dt.track_id,
       dt.created_at,
       t.title,
       t.artist,
       COALESCE(t.track_image, a.album_art) AS track_image
     FROM disliked_tracks dt
     JOIN tracks t ON dt.track_id = t.id
     LEFT JOIN albums a ON t.album_id = a.id
     WHERE dt.user_id = ? AND YEAR(dt.created_at) = ?
     ORDER BY dt.created_at DESC
     LIMIT 10`,
    [userId, year]
  );

  const [blockedArtists] = await pool.query(
    `SELECT 
       ba.artist_id,
       ba.created_at,
       ap.stage_name
     FROM blocked_artists ba
     JOIN artist_profiles ap ON ba.artist_id = ap.user_id
     WHERE ba.user_id = ? AND YEAR(ba.created_at) = ?
     ORDER BY ba.created_at DESC`,
    [userId, year]
  );

  return {
    year,
    summary: {
      totalListens: Number(listenSummary?.totalListens || 0),
      uniqueTracks: Number(listenSummary?.uniqueTracks || 0),
      firstListen: listenSummary?.firstListen || null,
      lastListen: listenSummary?.lastListen || null,
      topArtist: topArtists.length ? topArtists[0].artist : null
    },
    topTracks,
    topArtists: topArtists.map(a => ({
      artist: a.artist,
      listenCount: Number(a.listenCount)
    })),
    favouritesAdded,
    recentDislikes: dislikes.map(row => ({
      trackId: row.track_id,
      title: row.title,
      artist: row.artist,
      dislikedAt: row.created_at,
      track_image: buildImageUrl(req, row.track_image)
    })),
    blockedArtists: blockedArtists.map(row => ({
      artistId: row.artist_id,
      stage_name: row.stage_name,
      blockedAt: row.created_at
    }))
  };
};

const generatePlaylistId = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

exports.getYearInReview = async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth(); // 0-indexed, December = 11
    const currentYear = currentDate.getFullYear();

    // Year in review is only accessible in December
    if (currentMonth !== 11) {
      return res.status(403).json({
        error: 'Year in Review is only available in December',
        availableIn: 'December'
      });
    }

    // Check if snapshot already exists for this year
    const [existingSnapshot] = await pool.query(
      `SELECT id, playlist_id, snapshot_data, created_at
       FROM year_in_review_snapshots
       WHERE user_id = ? AND year = ?`,
      [userId, currentYear]
    );

    if (existingSnapshot.length > 0) {
      // Return existing snapshot
      const snapshot = existingSnapshot[0];
      let snapshotData = snapshot.snapshot_data;
      if (typeof snapshotData === 'string') {
        snapshotData = JSON.parse(snapshotData);
      }
      return res.json({
        ...snapshotData,
        playlistId: snapshot.playlist_id,
        generatedAt: snapshot.created_at,
        isNewGeneration: false
      });
    }

    // Generate new year in review
    const data = await buildYearInReview(userId, currentYear, req);

    // Create a playlist from top tracks
    let playlistId = null;
    if (data.topTracks && data.topTracks.length > 0) {
      playlistId = generatePlaylistId();
      const playlistName = `Your ${currentYear} Wrapped`;
      const playlistDesc = `Your top tracks from ${currentYear} - Generated by BeatFly Year in Review`;

      await pool.query(
        `INSERT INTO playlists (id, name, description, user_id, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [playlistId, playlistName, playlistDesc, userId]
      );

      // Add top tracks to the playlist
      for (const track of data.topTracks) {
        await pool.query(
          `INSERT IGNORE INTO playlist_tracks (playlist_id, track_id) VALUES (?, ?)`,
          [playlistId, track.trackId]
        );
      }
    }

    // Save the snapshot
    await pool.query(
      `INSERT INTO year_in_review_snapshots (user_id, year, playlist_id, snapshot_data, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [userId, currentYear, playlistId, JSON.stringify(data)]
    );

    res.json({
      ...data,
      playlistId,
      generatedAt: new Date(),
      isNewGeneration: true
    });
  } catch (error) {
    console.error('Year in review error:', error);
    res.status(500).json({ error: 'Failed to build year in review' });
  }
};

exports.getYearInReviewForAdmin = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const data = await buildYearInReview(userId, year, req);
    res.json(data);
  } catch (error) {
    console.error('Admin year in review error:', error);
    res.status(500).json({ error: 'Failed to build admin year in review' });
  }
};

exports.getSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureSettingsRow(userId);
    const [rows] = await pool.query(
      `SELECT allow_explicit, autoplay, share_activity, theme, language, updated_at
       FROM user_settings WHERE user_id = ?`,
      [userId]
    );
    res.json({ settings: rows[0] });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const userId = req.user.id;
    await ensureSettingsRow(userId);

    const allowedFields = {
      allow_explicit: (value) => (value ? 1 : 0),
      autoplay: (value) => (value ? 1 : 0),
      share_activity: (value) => (value ? 1 : 0),
      theme: (value) => (typeof value === 'string' ? value.slice(0, 50) : undefined),
      language: (value) => (typeof value === 'string' ? value.slice(0, 10) : undefined)
    };

    const updates = [];
    const values = [];

    Object.entries(allowedFields).forEach(([field, normalize]) => {
      if (req.body[field] !== undefined) {
        const normalized = normalize(req.body[field]);
        if (normalized !== undefined && normalized !== null) {
          updates.push(`${field} = ?`);
          values.push(normalized);
        }
      }
    });

    if (!updates.length) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }

    values.push(userId);

    await pool.query(
      `UPDATE user_settings SET ${updates.join(', ')}, updated_at = NOW() WHERE user_id = ?`,
      values
    );

    const [rows] = await pool.query(
      `SELECT allow_explicit, autoplay, share_activity, theme, language, updated_at
       FROM user_settings WHERE user_id = ?`,
      [userId]
    );

    res.json({ settings: rows[0] });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

exports.dislikeTrack = async (req, res) => {
  try {
    const userId = req.user.id;
    const { trackId } = req.body;
    if (!trackId) {
      return res.status(400).json({ error: 'Track ID required' });
    }

    const [trackRows] = await pool.query('SELECT id FROM tracks WHERE id = ?', [trackId]);
    if (!trackRows.length) {
      return res.status(404).json({ error: 'Track not found' });
    }

    await pool.query(
      `INSERT INTO disliked_tracks (user_id, track_id, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE created_at = NOW()`,
      [userId, trackId]
    );

    res.json({ message: 'Track disliked' });
  } catch (error) {
    console.error('Dislike track error:', error);
    res.status(500).json({ error: 'Failed to dislike track' });
  }
};

exports.removeDislike = async (req, res) => {
  try {
    const userId = req.user.id;
    const trackId = req.params.trackId;
    const [result] = await pool.query(
      'DELETE FROM disliked_tracks WHERE user_id = ? AND track_id = ?',
      [userId, trackId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Dislike not found' });
    }
    res.json({ message: 'Dislike removed' });
  } catch (error) {
    console.error('Remove dislike error:', error);
    res.status(500).json({ error: 'Failed to remove dislike' });
  }
};

exports.getDislikedTracks = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT 
         dt.track_id,
         dt.created_at,
         t.title,
         t.artist,
         COALESCE(t.track_image, a.album_art) AS track_image
       FROM disliked_tracks dt
       JOIN tracks t ON dt.track_id = t.id
       LEFT JOIN albums a ON t.album_id = a.id
       WHERE dt.user_id = ?
       ORDER BY dt.created_at DESC`,
      [userId]
    );

    const tracks = rows.map(row => ({
      trackId: row.track_id,
      title: row.title,
      artist: row.artist,
      dislikedAt: row.created_at,
      track_image: buildImageUrl(req, row.track_image)
    }));

    res.json({ tracks });
  } catch (error) {
    console.error('Get disliked tracks error:', error);
    res.status(500).json({ error: 'Failed to load disliked tracks' });
  }
};

exports.blockArtist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { artistId } = req.body;
    if (!artistId) {
      return res.status(400).json({ error: 'Artist ID required' });
    }

    const [artistRows] = await pool.query(
      `SELECT ap.user_id, ap.stage_name, u.username 
       FROM artist_profiles ap
       LEFT JOIN users u ON ap.user_id = u.id
       WHERE ap.user_id = ?`,
      [artistId]
    );
    if (!artistRows.length) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    await pool.query(
      `INSERT INTO blocked_artists (user_id, artist_id, created_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE created_at = NOW()`,
      [userId, artistId]
    );

    res.json({
      message: 'Artist blocked',
      artist: {
        artistId,
        stage_name: artistRows[0].stage_name,
        username: artistRows[0].username
      }
    });
  } catch (error) {
    console.error('Block artist error:', error);
    res.status(500).json({ error: 'Failed to block artist' });
  }
};

exports.unblockArtist = async (req, res) => {
  try {
    const userId = req.user.id;
    const { artistId } = req.params;
    const [result] = await pool.query(
      'DELETE FROM blocked_artists WHERE user_id = ? AND artist_id = ?',
      [userId, artistId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Blocked artist not found' });
    }
    res.json({ message: 'Artist unblocked' });
  } catch (error) {
    console.error('Unblock artist error:', error);
    res.status(500).json({ error: 'Failed to unblock artist' });
  }
};

exports.getBlockedArtists = async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.query(
      `SELECT 
         ba.artist_id,
         ba.created_at,
         ap.stage_name,
         u.username
       FROM blocked_artists ba
       JOIN artist_profiles ap ON ba.artist_id = ap.user_id
       LEFT JOIN users u ON ap.user_id = u.id
       WHERE ba.user_id = ?
       ORDER BY ba.created_at DESC`,
      [userId]
    );

    const artists = rows.map(row => ({
      artistId: row.artist_id,
      stage_name: row.stage_name,
      username: row.username,
      blockedAt: row.created_at
    }));

    res.json({ artists });
  } catch (error) {
    console.error('Get blocked artists error:', error);
    res.status(500).json({ error: 'Failed to load blocked artists' });
  }
};

exports.getPlaybackState = async (req, res) => {
  try {
    const userId = req.user.id;
    const state = await getPlaybackPosition(userId);
    res.json({ state: formatPlaybackState(state) });
  } catch (error) {
    console.error('Get playback state error:', error);
    res.status(500).json({ error: 'Failed to load playback state' });
  }
};

exports.savePlaybackState = async (req, res) => {
  try {
    const userId = req.user.id;
    const { trackId, positionSeconds = 0, isPaused = false } = req.body;
    if (!trackId) {
      return res.status(400).json({ error: 'Track ID required' });
    }

    const [trackRows] = await pool.query('SELECT id FROM tracks WHERE id = ?', [trackId]);
    if (!trackRows.length) {
      return res.status(404).json({ error: 'Track not found' });
    }

    await savePlaybackPosition({
      userId,
      trackId,
      positionSeconds: Number(positionSeconds) || 0,
      isPaused: Boolean(isPaused)
    });

    const state = await getPlaybackPosition(userId);
    res.json({ state: formatPlaybackState(state) });
  } catch (error) {
    console.error('Save playback state error:', error);
    res.status(500).json({ error: 'Failed to save playback state' });
  }
};

exports.getAdminUserOverview = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    const [userRows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    await ensureSettingsRow(userId);

    const [[settings]] = await pool.query(
      `SELECT allow_explicit, autoplay, share_activity, theme, language, updated_at
       FROM user_settings WHERE user_id = ?`,
      [userId]
    );

    const playback = await getPlaybackPosition(userId);

    const [[dislikedCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM disliked_tracks WHERE user_id = ?',
      [userId]
    );
    const [[blockedCount]] = await pool.query(
      'SELECT COUNT(*) AS count FROM blocked_artists WHERE user_id = ?',
      [userId]
    );

    res.json({
      userId,
      settings,
      playback: formatPlaybackState(playback),
      stats: {
        dislikedTracks: Number(dislikedCount.count || 0),
        blockedArtists: Number(blockedCount.count || 0)
      }
    });
  } catch (error) {
    console.error('Admin user overview error:', error);
    res.status(500).json({ error: 'Failed to load admin user overview' });
  }
};
