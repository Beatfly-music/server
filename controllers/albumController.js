const pool = require('../utils/db');
const compressAudio = require('../utils/compressAudio');
const removeExif = require('../utils/stripExif');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

/**
 * Helper: Builds a public image URL from a file path.
 */
function buildImageUrl(req, filePath) {
  if (!filePath) return "";
  const relative = filePath.replace(/^uploads[\/\\]/, '');
  return `${req.protocol}://${req.get('host')}/xrpc/images/${relative}`;
}

/**
 * Helper: Generate a random, unique 5-digit album ID.
 */
const generateUniqueAlbumId = async () => {
  let unique = false;
  let id;
  while (!unique) {
    id = Math.floor(10000 + Math.random() * 90000);
    const [rows] = await pool.query('SELECT id FROM albums WHERE id = ?', [id]);
    if (rows.length === 0) unique = true;
  }
  return id;
};

/**
 * Helper: Sanitizes a file name by replacing problematic characters.
 * (This is used only as a fallback if needed.)
 */
function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
}

/**
 * Retrieves an album along with its tracks and uploader info.
 */
exports.getAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
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
    
    if (album.album_art) {
      album.album_art = buildImageUrl(req, album.album_art);
    }
    
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
 * Creates a new album with album art (optional tracks).
 * Tracks can be added later using the addTrackToAlbum endpoint.
 */
exports.createAlbum = async (req, res) => {
  try {
    // Ensure a valid user is present.
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized: No valid user" });
    }
    const [userRows] = await pool.query("SELECT id FROM users WHERE id = ?", [req.user.id]);
    if (!userRows.length) {
      return res.status(400).json({ error: "User not found" });
    }

    // Validate album data.
    const { title, artist, description, isExplicit } = req.body;
    if (!title || !artist) {
      return res.status(400).json({ error: "Album title and artist are required." });
    }

    // Process album art (strip Exif data) if provided.
    let albumArtPath = null;
    if (req.files && req.files.albumArt && req.files.albumArt.length > 0) {
      // Use the already-sanitized file saved by Multer.
      albumArtPath = req.files.albumArt[0].path;
      const parsedArt = path.parse(albumArtPath);
      const cleanedPath = path.join(parsedArt.dir, `${parsedArt.name}-cleaned${parsedArt.ext}`);
      await removeExif(albumArtPath, cleanedPath);
      albumArtPath = cleanedPath;
    }

    const explicitFlag = isExplicit === 'true' || isExplicit === true ? 1 : 0;
    const albumId = await generateUniqueAlbumId();

    await pool.query(
      'INSERT INTO albums (id, title, artist, description, album_art, isExplicit, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [albumId, title, artist, description || '', albumArtPath, explicitFlag, req.user.id]
    );

    // Process track files if they're included (supporting backward compatibility)
    const trackFiles = req.files && req.files.tracks ? req.files.tracks : [];
    // Optional track titles, artists, and lyrics.
    let trackTitles = req.body.trackTitles;
    let trackArtists = req.body.trackArtists;
    let trackLyrics = req.body.trackLyrics;
    if (trackTitles && !Array.isArray(trackTitles)) trackTitles = [trackTitles];
    if (trackArtists && !Array.isArray(trackArtists)) trackArtists = [trackArtists];
    if (trackLyrics && !Array.isArray(trackLyrics)) trackLyrics = [trackLyrics];

    // Ensure our output directory exists.
    const outputDir = path.join('uploads', 'compressed');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      console.error("Error creating output directory:", err.message);
      console.error(err.stack);
    }

    // Loop through each track file if present.
    for (let i = 0; i < trackFiles.length; i++) {
      const file = trackFiles[i];
      // Use file.filename (set by the file upload middleware) if available,
      // otherwise fallback to originalname.
      const originalName = file.filename || file.originalname;
      // Sanitize the base name in case the middleware didn't cover it.
      const parsed = path.parse(originalName);
      const safeBaseName = sanitizeFilename(parsed.name);
      const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
      const outputFileName = `${safeBaseName}-${uniqueSuffix}${parsed.ext}`;
      const outputPath = path.join(outputDir, outputFileName);

      await compressAudio(file.path, outputPath);
      try {
        await fs.stat(outputPath);
      } catch (err) {
        console.error("Compressed file not found:", outputPath, err.message);
        console.error(err.stack);
      }

      // Use provided track title/artist if available; default to safeBaseName or album artist.
      const trackTitle = (trackTitles && trackTitles[i]) ? trackTitles[i] : safeBaseName;
      const trackArtist = (trackArtists && trackArtists[i]) ? trackArtists[i] : artist;
      const lyrics = (trackLyrics && trackLyrics[i]) ? trackLyrics[i] : "";

      await pool.query(
        'INSERT INTO tracks (album_id, title, artist, file_path, lyrics) VALUES (?, ?, ?, ?, ?)',
        [albumId, trackTitle, trackArtist, outputPath, lyrics]
      );
    }

    // Automatically create an artist profile if none exists.
    const [artistProfiles] = await pool.query("SELECT * FROM artist_profiles WHERE user_id = ?", [req.user.id]);
    if (!artistProfiles || artistProfiles.length === 0) {
      await pool.query(
        "INSERT INTO artist_profiles (user_id, stage_name, bio) VALUES (?, ?, ?)",
        [req.user.id, req.user.username, ""]
      );
    }

    // Get first track id (if any) for response.
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
 * Adds a new track to an existing album.
 * FIXED to work with upload.fields middleware
 */
exports.addTrackToAlbum = async (req, res) => {
  try {
    const { albumId } = req.params;
    const { title, artist, lyrics } = req.body;
    
    console.log("Received track upload request for album:", albumId);
    console.log("Request body:", req.body);
    console.log("Request files:", req.files);
    
    // Verify the album exists and belongs to this user
    const [albums] = await pool.query("SELECT * FROM albums WHERE id = ? AND user_id = ?", [albumId, req.user.id]);
    if (!albums || albums.length === 0) {
      return res.status(404).json({ error: "Album not found or not owned by you." });
    }
    const album = albums[0];

    // Check for file in req.files.trackFile since we're using upload.fields
    if (!req.files || !req.files.trackFile || !req.files.trackFile.length) {
      return res.status(400).json({ error: "No track file provided." });
    }
    
    // Use the first file from trackFile array
    const file = req.files.trackFile[0];
    console.log("Processing track file:", file.originalname, "size:", file.size);

    // Ensure our output directory exists
    const outputDir = path.join('uploads', 'compressed');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      console.error("Error creating output directory:", err.message);
      console.error(err.stack);
    }

    // Process the uploaded track file
    const originalName = file.filename || file.originalname;
    const parsed = path.parse(originalName);
    const safeBaseName = sanitizeFilename(parsed.name);
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(4).toString('hex');
    const outputFileName = `${safeBaseName}-${uniqueSuffix}${parsed.ext}`;
    const outputPath = path.join(outputDir, outputFileName);

    console.log("Compressing audio file to:", outputPath);
    // Compress the audio file
    await compressAudio(file.path, outputPath);
    try {
      await fs.stat(outputPath);
    } catch (err) {
      console.error("Compressed file not found:", outputPath, err.message);
      console.error(err.stack);
      return res.status(500).json({ error: "Failed to compress audio file." });
    }

    // Use provided track title/artist if available; default to filename or album artist
    const trackTitle = title || safeBaseName;
    const trackArtist = artist || album.artist;

    console.log("Saving track to database:", trackTitle, "by", trackArtist);
    // Save track to database
    const [result] = await pool.query(
      'INSERT INTO tracks (album_id, title, artist, file_path, lyrics) VALUES (?, ?, ?, ?, ?)',
      [albumId, trackTitle, trackArtist, outputPath, lyrics || ""]
    );
    
    // Get the ID of the newly created track
    const trackId = result.insertId;

    // Process track image if provided
    let trackImagePath = null;
    if (req.files && req.files.trackImage && req.files.trackImage.length > 0) {
      trackImagePath = req.files.trackImage[0].path;
      const parsedImage = path.parse(trackImagePath);
      const cleanedPath = path.join(parsedImage.dir, `${parsedImage.name}-cleaned${parsedImage.ext}`);
      await removeExif(trackImagePath, cleanedPath);
      trackImagePath = cleanedPath;
      
      // Update the track with the image path
      await pool.query("UPDATE tracks SET track_image = ? WHERE id = ?", [trackImagePath, trackId]);
    }

    console.log("Track added successfully:", trackId);
    res.status(201).json({ 
      message: "Track added successfully", 
      trackId,
      title: trackTitle,
      artist: trackArtist
    });
  } catch (error) {
    console.error("Add track error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/**
 * Updates an album. Supports updating album art and track lyrics.
 */
exports.editAlbum = async (req, res) => {
  try {
    const albumId = req.params.albumId;
    const { title, artist, description, isExplicit } = req.body;
    const [albums] = await pool.query("SELECT * FROM albums WHERE id = ? AND user_id = ?", [albumId, req.user.id]);
    if (!albums || albums.length === 0) {
      return res.status(404).json({ error: "Album not found or not owned by you." });
    }
    const album = albums[0];

    // Process new album art if provided.
    let newAlbumArtPath = album.album_art;
    if (req.files && req.files.albumArt && req.files.albumArt.length > 0) {
      newAlbumArtPath = req.files.albumArt[0].path;
      const parsedArt = path.parse(newAlbumArtPath);
      const cleanedPath = path.join(parsedArt.dir, `${parsedArt.name}-cleaned${parsedArt.ext}`);
      await removeExif(newAlbumArtPath, cleanedPath);
      newAlbumArtPath = cleanedPath;
      if (album.album_art && album.album_art !== newAlbumArtPath) {
        try {
          await fs.unlink(album.album_art);
        } catch (err) {
          console.error("Error deleting old album art:", err.message);
        }
      }
    }

    const newExplicit = (isExplicit !== undefined)
      ? (isExplicit === 'true' || isExplicit === true ? 1 : 0)
      : album.isExplicit;

    await pool.query(
      "UPDATE albums SET title = ?, artist = ?, description = ?, isExplicit = ?, album_art = ? WHERE id = ?",
      [title || album.title, artist || album.artist, description || album.description, newExplicit, newAlbumArtPath, albumId]
    );

    // Update track lyrics if provided.
    if (req.body.trackLyrics) {
      const trackLyrics = req.body.trackLyrics;
      for (const [trackId, lyrics] of Object.entries(trackLyrics)) {
        await pool.query("UPDATE tracks SET lyrics = ? WHERE id = ? AND album_id = ?", [lyrics, trackId, albumId]);
      }
    }

    res.json({ message: "Album updated successfully" });
  } catch (error) {
    console.error("Edit album error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/**
 * Deletes an album along with its associated track and album art files.
 */
exports.deleteAlbum = async (req, res) => {
  try {
    const albumId = req.params.albumId;
    const [albums] = await pool.query("SELECT * FROM albums WHERE id = ? AND user_id = ?", [albumId, req.user.id]);
    if (!albums || albums.length === 0) {
      return res.status(404).json({ error: "Album not found or not owned by you." });
    }
    const album = albums[0];

    // Get all tracks for this album
    const [tracks] = await pool.query("SELECT * FROM tracks WHERE album_id = ?", [albumId]);
    
    // Delete entries in streaming_sessions that reference these tracks
    if (tracks.length > 0) {
      const trackIds = tracks.map(track => track.id);
      await pool.query(
        "DELETE FROM streaming_sessions WHERE track_id IN (?)",
        [trackIds]
      );
    }

    // Now it's safe to delete the track files and records
    for (const track of tracks) {
      if (track.file_path) {
        try {
          await fs.unlink(track.file_path);
          console.log(`Deleted track file: ${track.file_path}`);
        } catch (err) {
          console.error(`Error deleting track file (${track.file_path}):`, err.message);
        }
      }
      if (track.track_image) {
        try {
          await fs.unlink(track.track_image);
          console.log(`Deleted track image: ${track.track_image}`);
        } catch (err) {
          console.error(`Error deleting track image (${track.track_image}):`, err.message);
        }
      }
    }

    // Delete track records
    await pool.query("DELETE FROM tracks WHERE album_id = ?", [albumId]);

    // Delete album art
    if (album.album_art) {
      try {
        await fs.unlink(album.album_art);
        console.log(`Deleted album art: ${album.album_art}`);
      } catch (err) {
        console.error(`Error deleting album art (${album.album_art}):`, err.message);
      }
    }

    // Finally, delete the album record
    await pool.query("DELETE FROM albums WHERE id = ?", [albumId]);
    res.json({ message: "Album and associated files deleted successfully" });
  } catch (error) {
    console.error("Delete album error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};

/**
 * Deletes a track from an album.
 */
exports.deleteTrack = async (req, res) => {
  try {
    const { albumId, trackId } = req.params;
    
    // Verify the album exists and belongs to this user
    const [albums] = await pool.query("SELECT * FROM albums WHERE id = ? AND user_id = ?", [albumId, req.user.id]);
    if (!albums || albums.length === 0) {
      return res.status(404).json({ error: "Album not found or not owned by you." });
    }
    
    // Fetch track info
    const [tracks] = await pool.query("SELECT * FROM tracks WHERE id = ? AND album_id = ?", [trackId, albumId]);
    if (!tracks || tracks.length === 0) {
      return res.status(404).json({ error: "Track not found or doesn't belong to this album." });
    }
    const track = tracks[0];
    
    // Delete entries in streaming_sessions that reference this track
    await pool.query("DELETE FROM streaming_sessions WHERE track_id = ?", [trackId]);
    
    // Delete track file
    if (track.file_path) {
      try {
        await fs.unlink(track.file_path);
        console.log(`Deleted track file: ${track.file_path}`);
      } catch (err) {
        console.error(`Error deleting track file (${track.file_path}):`, err.message);
      }
    }
    
    // Delete track image if present
    if (track.track_image) {
      try {
        await fs.unlink(track.track_image);
        console.log(`Deleted track image: ${track.track_image}`);
      } catch (err) {
        console.error(`Error deleting track image (${track.track_image}):`, err.message);
      }
    }
    
    // Delete track from database
    await pool.query("DELETE FROM tracks WHERE id = ?", [trackId]);
    
    res.json({ message: "Track deleted successfully" });
  } catch (error) {
    console.error("Delete track error:", error.message);
    console.error(error.stack);
    res.status(500).json({ error: "Internal server error", details: error.message });
  }
};