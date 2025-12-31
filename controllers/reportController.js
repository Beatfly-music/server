const pool = require('../utils/db');

exports.reportArtist = async (req, res) => {
  try {
    const reporterId = req.user.id;
    const { artistID, category, description } = req.body;

    if (!artistID) {
      return res.status(400).json({ error: 'Artist ID required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'Category required' });
    }

    const validCategories = [
      'Copyright',
      'Inappropriate Content',
      'Spam',
      'Harassment',
      'Impersonation',
      'Fraud',
      'Other'
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category',
        validCategories
      });
    }

    // Check if artist exists
    const [artistRows] = await pool.query(
      `SELECT ap.user_id, ap.stage_name
       FROM artist_profiles ap
       WHERE ap.user_id = ?`,
      [artistID]
    );

    if (!artistRows.length) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Can't report yourself
    if (Number(artistID) === reporterId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Check for duplicate recent reports (within 24 hours)
    const [existingReport] = await pool.query(
      `SELECT id FROM artist_reports
       WHERE artist_id = ? AND reporter_id = ? AND category = ?
       AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
      [artistID, reporterId, category]
    );

    if (existingReport.length) {
      return res.status(429).json({
        error: 'You have already reported this artist for this reason recently',
        retryAfter: '24 hours'
      });
    }

    // Create the report
    const [result] = await pool.query(
      `INSERT INTO artist_reports (artist_id, reporter_id, category, description, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', NOW())`,
      [artistID, reporterId, category, description || null]
    );

    res.status(201).json({
      message: 'Report submitted successfully',
      report: {
        id: result.insertId,
        artistId: Number(artistID),
        artistName: artistRows[0].stage_name,
        category,
        description: description || null,
        status: 'pending',
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Report artist error:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
};

exports.getMyReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0 } = req.query;

    const [rows] = await pool.query(
      `SELECT ar.id, ar.artist_id, ar.category, ar.description, ar.status, ar.created_at,
              ap.stage_name
       FROM artist_reports ar
       JOIN artist_profiles ap ON ar.artist_id = ap.user_id
       WHERE ar.reporter_id = ?
       ORDER BY ar.created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, Number(limit), Number(offset)]
    );

    res.json({ reports: rows });
  } catch (error) {
    console.error('Get my reports error:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
};
