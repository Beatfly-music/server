const pool = require('../utils/db');
const compressAudio = require('../utils/compressAudio');
const removeExif = require('../utils/stripExif');
const path = require('path');
const fs = require('fs').promises;

/**
 * Helper function to build a public image URL.
 * It removes the "uploads/" prefix from the stored file path and then
 * returns a URL that uses the image route.
 *
 * Example:
 *   filePath: "uploads/albumArt/filename.jpg"
 *   returns: "http://localhost:5000/xrpc/images/albumArt/filename.jpg"
 */
function buildImageUrl(req, filePath) {
  if (!filePath) return "";
  // Remove any leading "uploads/" (handling both forward and backslashes)
  const relative = filePath.replace(/^uploads[\/\\]/, '');
  return `${req.protocol}://${req.get('host')}/xrpc/images/${relative}`;
}

/**
 * Helper function to generate a random 10-digit album ID
 * that is unique within the albums table.
 */
const generateUniqueAlbumId = async () => {
  let unique = false;
  let id;
  while (!unique) {
    // Generate a random 10-digit number.
    id = Math.floor(10000 + Math.random() * 90000);
    const [rows] = await pool.query('SELECT id FROM albums WHERE id = ?', [id]);
    if (rows.length === 0) {
      unique = true;
    }
  }
  return id;
};

/**
 * Public endpoint to retrieve an album by ID along with its associated tracks
 * and uploader information.
 */
exports.getAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    // Fetch album info along with uploader details by joining the users table.
    const [albumRows] = await pool.query(
      `SELECT a.*, u.username AS uploader_username, u.email AS uploader_email, u.created_at AS uploader_created_at 
       FROM albums a
       JOIN users u ON a.user_id = u.id 
       WHERE a.id = ?`,
      [albumId]
    );
    if (!albumRows || albumRows.length === 0) {
      return res.status(404).json({ error: "Album not found" });
    }
    let album = albumRows[0];
    
    // Convert album_art to a public URL if available.
    if (album.album_art) {
      album.album_art = buildImageUrl(req, album.album_art);
    }
    
    // Fetch associated tracks.
    const [tracks] = await pool.query("SELECT * FROM tracks WHERE album_id = ?", [albumId]);
    album.tracks = tracks.map(track => {
      if (track.track_image) {
        track.track_image = buildImageUrl(req, track.track_image);
      }
      return track;
    });
    
    res.json(album);
  } catch (error) {
    console.error("Error fetching album:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/**
 * Creates a new album along with processing uploaded album art and track files.
 * This endpoint requires authentication (req.user is assumed to be populated).
 */
exports.createAlbum = async (req, res) => {
  try {
    // Ensure we have an authenticated user.
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized: No valid user" });
    }

    // Verify that the user exists in the database.
    const [userRows] = await pool.query("SELECT id FROM users WHERE id = ?", [req.user.id]);
    if (!userRows.length) {
      return res.status(400).json({ error: "User not found" });
    }

    // Extract album details from the request body.
    const { title, artist, description, isExplicit } = req.body;
    if (!title || !artist) {
      return res.status(400).json({ error: "Album title and artist are required." });
    }
    
    // Process album art if provided.
    let albumArtPath = null;
    if (req.files && req.files.albumArt && req.files.albumArt.length > 0) {
      albumArtPath = req.files.albumArt[0].path;
      const parsedArt = path.parse(albumArtPath);
      const cleanedPath = path.join(parsedArt.dir, `${parsedArt.name}-cleaned${parsedArt.ext}`);
      await removeExif(albumArtPath, cleanedPath);
      albumArtPath = cleanedPath;
    }
    
    // Determine the explicit flag.
    const explicitFlag = isExplicit === 'true' || isExplicit === true ? 1 : 0;
    
    // Generate a unique album ID.
    const albumId = await generateUniqueAlbumId();
    
    // Insert album record into the database (including isExplicit and the generated album ID).
    await pool.query(
      'INSERT INTO albums (id, title, artist, description, album_art, isExplicit, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [albumId, title, artist, description || '', albumArtPath, explicitFlag, req.user.id]
    );
    
    // Process uploaded track files.
    const trackFiles = req.files && req.files.tracks ? req.files.tracks : [];
    let trackTitles = req.body.trackTitles;
    let trackArtists = req.body.trackArtists;
    if (trackTitles && !Array.isArray(trackTitles)) trackTitles = [trackTitles];
    if (trackArtists && !Array.isArray(trackArtists)) trackArtists = [trackArtists];
    
    const outputDir = path.join('uploads', 'compressed');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      console.error("Error creating output directory:", err.message);
      console.error(err.stack);
    }
    
    // For each uploaded track file, compress and insert it.
    for (let i = 0; i < trackFiles.length; i++) {
      const file = trackFiles[i];
      const filename = path.basename(file.path);
      const parsedTrack = path.parse(filename);
      const outputPath = path.join(outputDir, `${parsedTrack.name}-compressed${parsedTrack.ext}`);
      
      await compressAudio(file.path, outputPath);
      
      try {
        await fs.stat(outputPath);
      } catch (err) {
        console.error("Compressed file not found:", outputPath, err.message);
        console.error(err.stack);
      }
      
      const trackTitle = (trackTitles && trackTitles[i]) ? trackTitles[i] : file.originalname;
      const trackArtist = (trackArtists && trackArtists[i]) ? trackArtists[i] : artist;
      await pool.query(
        'INSERT INTO tracks (album_id, title, artist, file_path) VALUES (?, ?, ?, ?)',
        [albumId, trackTitle, trackArtist, outputPath]
      );
    }
    
    // Automatically create an artist profile if not already present.
    const [artistProfiles] = await pool.query("SELECT * FROM artist_profiles WHERE user_id = ?", [req.user.id]);
    if (!artistProfiles || artistProfiles.length === 0) {
      await pool.query(
        "INSERT INTO artist_profiles (user_id, stage_name, bio) VALUES (?, ?, ?)",
        [req.user.id, req.user.username, ""]
      );
    }
    
    // Retrieve the first inserted track ID.
    const [trackRows] = await pool.query("SELECT id FROM tracks WHERE album_id = ? LIMIT 1", [albumId]);
    const firstTrackId = trackRows.length > 0 ? trackRows[0].id : null;
    
    res.status(201).json({ message: "Album created successfully", albumId, trackId: firstTrackId });
  } catch (error) {
    console.error("Create album error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/**
 * Updates an album. Only the owner (authenticated user) may update.
 */
exports.editAlbum = async (req, res) => {
  try {
    const albumId = req.params.albumId;
    // Extract album details from the request body.
    const { title, artist, description, isExplicit } = req.body;
    const [albums] = await pool.query("SELECT * FROM albums WHERE id = ? AND user_id = ?", [albumId, req.user.id]);
    if (!albums || albums.length === 0) {
      return res.status(404).json({ error: "Album not found or not owned by you." });
    }
    
    // Determine the new explicit flag.
    const newExplicit = (isExplicit !== undefined)
      ? (isExplicit === 'true' || isExplicit === true ? 1 : 0)
      : albums[0].isExplicit;
    
    await pool.query(
      "UPDATE albums SET title = ?, artist = ?, description = ?, isExplicit = ? WHERE id = ?",
      [
        title || albums[0].title,
        artist || albums[0].artist,
        description || albums[0].description,
        newExplicit,
        albumId
      ]
    );
    res.json({ message: "Album updated successfully" });
  } catch (error) {
    console.error("Edit album error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/**
 * Deletes an album. Only the owner (authenticated user) may delete.
 */
exports.deleteAlbum = async (req, res) => {
  try {
    const albumId = req.params.albumId;
    const [albums] = await pool.query("SELECT * FROM albums WHERE id = ? AND user_id = ?", [albumId, req.user.id]);
    if (!albums || albums.length === 0) {
      return res.status(404).json({ error: "Album not found or not owned by you." });
    }
    await pool.query("DELETE FROM albums WHERE id = ?", [albumId]);
    res.json({ message: "Album deleted successfully" });
  } catch (error) {
    console.error("Delete album error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });   
  }
};
