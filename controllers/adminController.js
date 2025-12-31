const pool = require('../utils/db');
const fs = require('fs').promises;
const path = require('path');

// ==================== USER MANAGEMENT ====================

exports.banUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { userId, reason, expiresAt } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    // Check if user exists
    const [userRows] = await pool.query('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Can't ban yourself
    if (userId === adminId) {
      return res.status(400).json({ error: 'Cannot ban yourself' });
    }

    // Can't ban other admins
    const [adminCheck] = await pool.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (adminCheck.length && adminCheck[0].is_admin) {
      return res.status(400).json({ error: 'Cannot ban an admin user' });
    }

    await pool.query(
      `INSERT INTO banned_users (user_id, reason, banned_by, banned_at, expires_at)
       VALUES (?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by),
       banned_at = NOW(), expires_at = VALUES(expires_at)`,
      [userId, reason || null, adminId, expiresAt || null]
    );

    res.json({
      message: 'User banned successfully',
      user: { userId, username: userRows[0].username },
      reason,
      expiresAt: expiresAt || 'permanent'
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

exports.unbanUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const [result] = await pool.query('DELETE FROM banned_users WHERE user_id = ?', [userId]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Ban record not found' });
    }

    res.json({ message: 'User unbanned successfully', userId: Number(userId) });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
};

exports.getBannedUsers = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT bu.user_id, bu.reason, bu.banned_at, bu.expires_at,
              u.username, u.email,
              admin.username AS banned_by_username
       FROM banned_users bu
       JOIN users u ON bu.user_id = u.id
       JOIN users admin ON bu.banned_by = admin.id
       ORDER BY bu.banned_at DESC`
    );

    res.json({ bannedUsers: rows });
  } catch (error) {
    console.error('Get banned users error:', error);
    res.status(500).json({ error: 'Failed to get banned users' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { userId } = req.params;

    if (Number(userId) === adminId) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const [userRows] = await pool.query('SELECT id, username, is_admin FROM users WHERE id = ?', [userId]);
    if (!userRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userRows[0].is_admin) {
      return res.status(400).json({ error: 'Cannot delete an admin user' });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ message: 'User deleted successfully', userId: Number(userId), username: userRows[0].username });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// ==================== ARTIST MANAGEMENT ====================

exports.banArtist = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { artistId, reason, expiresAt } = req.body;

    if (!artistId) {
      return res.status(400).json({ error: 'Artist ID required' });
    }

    // Check if artist profile exists
    const [artistRows] = await pool.query(
      `SELECT ap.user_id, ap.stage_name, u.username
       FROM artist_profiles ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.user_id = ?`,
      [artistId]
    );
    if (!artistRows.length) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    await pool.query(
      `INSERT INTO banned_artists (artist_id, reason, banned_by, banned_at, expires_at)
       VALUES (?, ?, ?, NOW(), ?)
       ON DUPLICATE KEY UPDATE reason = VALUES(reason), banned_by = VALUES(banned_by),
       banned_at = NOW(), expires_at = VALUES(expires_at)`,
      [artistId, reason || null, adminId, expiresAt || null]
    );

    res.json({
      message: 'Artist banned successfully',
      artist: {
        artistId,
        stage_name: artistRows[0].stage_name,
        username: artistRows[0].username
      },
      reason,
      expiresAt: expiresAt || 'permanent'
    });
  } catch (error) {
    console.error('Ban artist error:', error);
    res.status(500).json({ error: 'Failed to ban artist' });
  }
};

exports.unbanArtist = async (req, res) => {
  try {
    const { artistId } = req.params;

    const [result] = await pool.query('DELETE FROM banned_artists WHERE artist_id = ?', [artistId]);
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Ban record not found' });
    }

    res.json({ message: 'Artist unbanned successfully', artistId: Number(artistId) });
  } catch (error) {
    console.error('Unban artist error:', error);
    res.status(500).json({ error: 'Failed to unban artist' });
  }
};

exports.getBannedArtists = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ba.artist_id, ba.reason, ba.banned_at, ba.expires_at,
              ap.stage_name, u.username,
              admin.username AS banned_by_username
       FROM banned_artists ba
       JOIN artist_profiles ap ON ba.artist_id = ap.user_id
       JOIN users u ON ap.user_id = u.id
       JOIN users admin ON ba.banned_by = admin.id
       ORDER BY ba.banned_at DESC`
    );

    res.json({ bannedArtists: rows });
  } catch (error) {
    console.error('Get banned artists error:', error);
    res.status(500).json({ error: 'Failed to get banned artists' });
  }
};

// ==================== ALBUM MANAGEMENT ====================

exports.renameAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { title, artist, description } = req.body;

    if (!title && !artist && description === undefined) {
      return res.status(400).json({ error: 'At least one field (title, artist, description) required' });
    }

    const [albumRows] = await pool.query('SELECT id, title, artist FROM albums WHERE id = ?', [albumId]);
    if (!albumRows.length) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }
    if (artist) {
      updates.push('artist = ?');
      values.push(artist);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }

    values.push(albumId);

    await pool.query(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updated] = await pool.query('SELECT * FROM albums WHERE id = ?', [albumId]);

    res.json({
      message: 'Album updated successfully',
      album: updated[0]
    });
  } catch (error) {
    console.error('Rename album error:', error);
    res.status(500).json({ error: 'Failed to rename album' });
  }
};

exports.deleteAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;

    const [albumRows] = await pool.query(
      'SELECT id, title, album_art FROM albums WHERE id = ?',
      [albumId]
    );
    if (!albumRows.length) {
      return res.status(404).json({ error: 'Album not found' });
    }

    // Get tracks to delete their files
    const [tracks] = await pool.query('SELECT file_path, track_image FROM tracks WHERE album_id = ?', [albumId]);

    // Delete track files
    for (const track of tracks) {
      if (track.file_path) {
        try {
          await fs.unlink(path.join(__dirname, '..', track.file_path));
        } catch (err) {
          console.error('Failed to delete track file:', err.message);
        }
      }
      if (track.track_image) {
        try {
          await fs.unlink(path.join(__dirname, '..', track.track_image));
        } catch (err) {
          console.error('Failed to delete track image:', err.message);
        }
      }
    }

    // Delete album art
    if (albumRows[0].album_art) {
      try {
        await fs.unlink(path.join(__dirname, '..', albumRows[0].album_art));
      } catch (err) {
        console.error('Failed to delete album art:', err.message);
      }
    }

    // Delete album (cascade deletes tracks)
    await pool.query('DELETE FROM albums WHERE id = ?', [albumId]);

    res.json({
      message: 'Album deleted successfully',
      albumId: Number(albumId),
      title: albumRows[0].title
    });
  } catch (error) {
    console.error('Delete album error:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }
};

// ==================== TRACK MANAGEMENT ====================

exports.renameTrack = async (req, res) => {
  try {
    const { trackId } = req.params;
    const { title, artist, lyrics } = req.body;

    if (!title && !artist && lyrics === undefined) {
      return res.status(400).json({ error: 'At least one field (title, artist, lyrics) required' });
    }

    const [trackRows] = await pool.query('SELECT id, title, artist FROM tracks WHERE id = ?', [trackId]);
    if (!trackRows.length) {
      return res.status(404).json({ error: 'Track not found' });
    }

    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }
    if (artist) {
      updates.push('artist = ?');
      values.push(artist);
    }
    if (lyrics !== undefined) {
      updates.push('lyrics = ?');
      values.push(lyrics);
    }

    values.push(trackId);

    await pool.query(`UPDATE tracks SET ${updates.join(', ')} WHERE id = ?`, values);

    const [updated] = await pool.query('SELECT * FROM tracks WHERE id = ?', [trackId]);

    res.json({
      message: 'Track updated successfully',
      track: updated[0]
    });
  } catch (error) {
    console.error('Rename track error:', error);
    res.status(500).json({ error: 'Failed to rename track' });
  }
};

exports.deleteTrack = async (req, res) => {
  try {
    const { trackId } = req.params;

    const [trackRows] = await pool.query(
      'SELECT id, title, file_path, track_image FROM tracks WHERE id = ?',
      [trackId]
    );
    if (!trackRows.length) {
      return res.status(404).json({ error: 'Track not found' });
    }

    // Delete track file
    if (trackRows[0].file_path) {
      try {
        await fs.unlink(path.join(__dirname, '..', trackRows[0].file_path));
      } catch (err) {
        console.error('Failed to delete track file:', err.message);
      }
    }

    // Delete track image
    if (trackRows[0].track_image) {
      try {
        await fs.unlink(path.join(__dirname, '..', trackRows[0].track_image));
      } catch (err) {
        console.error('Failed to delete track image:', err.message);
      }
    }

    await pool.query('DELETE FROM tracks WHERE id = ?', [trackId]);

    res.json({
      message: 'Track deleted successfully',
      trackId: Number(trackId),
      title: trackRows[0].title
    });
  } catch (error) {
    console.error('Delete track error:', error);
    res.status(500).json({ error: 'Failed to delete track' });
  }
};

// ==================== REPORT MANAGEMENT ====================

exports.getReports = async (req, res) => {
  try {
    const { status, artistId, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT ar.id, ar.artist_id, ar.reporter_id, ar.category, ar.description,
             ar.status, ar.reviewed_by, ar.reviewed_at, ar.created_at,
             ap.stage_name, u.username AS reporter_username,
             reviewer.username AS reviewer_username
      FROM artist_reports ar
      JOIN artist_profiles ap ON ar.artist_id = ap.user_id
      JOIN users u ON ar.reporter_id = u.id
      LEFT JOIN users reviewer ON ar.reviewed_by = reviewer.id
    `;

    const conditions = [];
    const values = [];

    if (status) {
      conditions.push('ar.status = ?');
      values.push(status);
    }
    if (artistId) {
      conditions.push('ar.artist_id = ?');
      values.push(artistId);
    }

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY ar.created_at DESC LIMIT ? OFFSET ?';
    values.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, values);

    res.json({ reports: rows });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { reportId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
    }

    const [reportRows] = await pool.query('SELECT id FROM artist_reports WHERE id = ?', [reportId]);
    if (!reportRows.length) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await pool.query(
      `UPDATE artist_reports SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?`,
      [status, adminId, reportId]
    );

    const [updated] = await pool.query(
      `SELECT ar.*, ap.stage_name, u.username AS reporter_username
       FROM artist_reports ar
       JOIN artist_profiles ap ON ar.artist_id = ap.user_id
       JOIN users u ON ar.reporter_id = u.id
       WHERE ar.id = ?`,
      [reportId]
    );

    res.json({
      message: 'Report status updated',
      report: updated[0]
    });
  } catch (error) {
    console.error('Update report status error:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
};

// ==================== STATS & OVERVIEW ====================

exports.getStats = async (req, res) => {
  try {
    const [[userCount]] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const [[artistCount]] = await pool.query('SELECT COUNT(*) AS count FROM artist_profiles');
    const [[albumCount]] = await pool.query('SELECT COUNT(*) AS count FROM albums');
    const [[trackCount]] = await pool.query('SELECT COUNT(*) AS count FROM tracks');
    const [[playlistCount]] = await pool.query('SELECT COUNT(*) AS count FROM playlists');
    const [[bannedUserCount]] = await pool.query('SELECT COUNT(*) AS count FROM banned_users');
    const [[bannedArtistCount]] = await pool.query('SELECT COUNT(*) AS count FROM banned_artists');
    const [[pendingReports]] = await pool.query(
      "SELECT COUNT(*) AS count FROM artist_reports WHERE status = 'pending'"
    );

    res.json({
      stats: {
        users: Number(userCount.count),
        artists: Number(artistCount.count),
        albums: Number(albumCount.count),
        tracks: Number(trackCount.count),
        playlists: Number(playlistCount.count),
        bannedUsers: Number(bannedUserCount.count),
        bannedArtists: Number(bannedArtistCount.count),
        pendingReports: Number(pendingReports.count)
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    let query = `
      SELECT u.id, u.username, u.email, u.is_admin, u.created_at,
             up.biography, up.profile_pic,
             CASE WHEN ap.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_artist,
             CASE WHEN bu.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_banned
      FROM users u
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN artist_profiles ap ON u.id = ap.user_id
      LEFT JOIN banned_users bu ON u.id = bu.user_id
    `;

    const values = [];

    if (search) {
      query += ' WHERE u.username LIKE ? OR u.email LIKE ?';
      values.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    values.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, values);

    res.json({ users: rows });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
};

exports.getAllArtists = async (req, res) => {
  try {
    const { limit = 50, offset = 0, search } = req.query;

    let query = `
      SELECT ap.user_id AS artistId, ap.stage_name, ap.bio,
             u.username, u.email, u.created_at,
             CASE WHEN ba.artist_id IS NOT NULL THEN 1 ELSE 0 END AS is_banned,
             (SELECT COUNT(*) FROM albums WHERE user_id = ap.user_id) AS album_count,
             (SELECT COUNT(*) FROM tracks t JOIN albums a ON t.album_id = a.id WHERE a.user_id = ap.user_id) AS track_count
      FROM artist_profiles ap
      JOIN users u ON ap.user_id = u.id
      LEFT JOIN banned_artists ba ON ap.user_id = ba.artist_id
    `;

    const values = [];

    if (search) {
      query += ' WHERE ap.stage_name LIKE ? OR u.username LIKE ?';
      values.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
    values.push(Number(limit), Number(offset));

    const [rows] = await pool.query(query, values);

    res.json({ artists: rows });
  } catch (error) {
    console.error('Get all artists error:', error);
    res.status(500).json({ error: 'Failed to get artists' });
  }
};
