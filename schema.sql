-- Updated schema.sql for BeatFly Backend with Listens Tracking and Featured Functionality

-- 1. Users Table: Holds basic account information.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. User Profiles: Additional details for regular users.
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id INT PRIMARY KEY,
  biography TEXT,
  profile_pic VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 3. Artist Profiles: For users that are artists. Automatically created if a user uploads music.
CREATE TABLE IF NOT EXISTS artist_profiles (
  user_id INT PRIMARY KEY,
  stage_name VARCHAR(255),
  bio TEXT,
  promoted_album INT DEFAULT NULL,
  promoted_track INT DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Albums: Contains album information; each album is created by a user.
CREATE TABLE IF NOT EXISTS albums (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  description TEXT,
  album_art VARCHAR(255),
  user_id INT,
  listens INT DEFAULT 0,  -- New: Total listens count for the album
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. Tracks: Contains individual track information associated with an album.
CREATE TABLE IF NOT EXISTS tracks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  album_id INT,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  track_image VARCHAR(255),  -- New: A dedicated track image (nullable)
  listens INT DEFAULT 0,       -- New: Total listens count for the track
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Playlists: User-created playlists.
CREATE TABLE IF NOT EXISTS playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Playlist Tracks: Join table to associate playlists with tracks.
CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INT,
  track_id INT,
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 8. Favourite Albums: Users can mark albums as favourites.
CREATE TABLE IF NOT EXISTS favourite_albums (
  user_id INT,
  album_id INT,
  PRIMARY KEY (user_id, album_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. Favourite Tracks: Users can mark tracks as favourites.
CREATE TABLE IF NOT EXISTS favourite_tracks (
  user_id INT,
  track_id INT,
  PRIMARY KEY (user_id, track_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Favourite Artists: Users can mark artist profiles as favourites.
CREATE TABLE IF NOT EXISTS favourite_artists (
  user_id INT,
  artist_id INT,
  PRIMARY KEY (user_id, artist_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (artist_id) REFERENCES artist_profiles(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. Listens: Records each listen event for a track by a user.
-- This table is used to enforce the rule that the same account can only add 1 listen per track every 12 hours.
CREATE TABLE IF NOT EXISTS listens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  track_id INT NOT NULL,
  listened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  INDEX idx_user_track (user_id, track_id, listened_at)
) ENGINE=InnoDB;

CREATE TABLE streaming_sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id INT NOT NULL,
  track_id INT NOT NULL,
  current_segment INT NOT NULL,
  expires_at DATETIME NOT NULL,
  encryption_key BLOB,
  iv BLOB,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id)
);