const pool = require('./db');

/**
 * Upsert playback position for a user.
 */
async function savePlaybackPosition({ userId, trackId, positionSeconds = 0, isPaused = false }) {
  await pool.query(
    `INSERT INTO playback_positions (user_id, track_id, position_seconds, is_paused, updated_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       track_id = VALUES(track_id),
       position_seconds = VALUES(position_seconds),
       is_paused = VALUES(is_paused),
       updated_at = VALUES(updated_at)`,
    [userId, trackId, positionSeconds, isPaused ? 1 : 0]
  );
}

/**
 * Return the latest playback position for a user, if available.
 */
async function getPlaybackPosition(userId) {
  const [rows] = await pool.query(
    `SELECT user_id, track_id, position_seconds, is_paused, updated_at
     FROM playback_positions
     WHERE user_id = ?`,
    [userId]
  );
  return rows.length ? rows[0] : null;
}

function formatPlaybackState(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    trackId: row.track_id,
    positionSeconds: Number(row.position_seconds || 0),
    isPaused: Boolean(row.is_paused),
    updatedAt: row.updated_at
  };
}

module.exports = {
  savePlaybackPosition,
  getPlaybackPosition,
  formatPlaybackState
};
