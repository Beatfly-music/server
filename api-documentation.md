# Beatfly API Documentation

## Overview
This is a complete RESTful API for a music streaming service, supporting user accounts, music uploads, streaming, playlists, favorites, and more.

## Base URL
```
/xrpc
```

## Authentication
Most endpoints require JWT authentication. Include the token in request headers:
```
Authorization: Bearer <jwt_token>
```

## Media Handling
- Audio files are automatically compressed to 128k bitrate
- Image files have EXIF data automatically stripped
- Files are stored in organized directories
- Streaming supports partial content (ranges)

## Error Responses
All errors follow this format:
```json
{
  "error": "Error description message"
}
```

Common status codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

## Account Management

### Register Account
- **Endpoint**: `POST /account.register`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "username": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "message": "User registered successfully",
    "userId": "number"
  }
  ```

### Login
- **Endpoint**: `POST /account.login`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response**:
  ```json
  {
    "token": "string" // JWT token
  }
  ```

### Get Profile
- **Endpoint**: `GET /account.profile`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "id": "number",
    "username": "string",
    "email": "string",
    "created_at": "string"
  }
  ```

### Forgot Password
- **Endpoint**: `POST /account.forgotPassword`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "email": "string"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Password reset token generated",
    "resetToken": "string"
  }
  ```

### Reset Password
- **Endpoint**: `POST /account.resetPassword`
- **Auth Required**: No
- **Body**:
  ```json
  {
    "token": "string",
    "newPassword": "string"
  }
  ```

## Music Management

### Create Album
- **Endpoint**: `POST /music/album.create`
- **Auth Required**: Yes
- **Content-Type**: `multipart/form-data`
- **Body**:
  ```
  title: string (required)
  artist: string (required)
  description: string (optional)
  albumArt: File (optional, image)
  tracks: File[] (up to 20 audio files)
  trackTitles: string[] (matches tracks order)
  trackArtists: string[] (matches tracks order)
  ```
- **Processing**:
  - Album art: EXIF data stripped
  - Audio tracks: Compressed to 128k bitrate
  - Automatic artist profile creation if not exists
- **Response**:
  ```json
  {
    "message": "Album created successfully",
    "albumId": "number",
    "trackId": "number" // First track ID
  }
  ```

### Get Album
- **Endpoint**: `GET /music/album/:albumId`
- **Auth Required**: No
- **Response**:
  ```json
  {
    "id": "number",
    "title": "string",
    "artist": "string",
    "description": "string",
    "album_art": "string" (URL),
    "uploader_username": "string",
    "uploader_email": "string",
    "uploader_created_at": "string",
    "tracks": [
      {
        "id": "number",
        "title": "string",
        "artist": "string",
        "track_image": "string" (URL)
      }
    ]
  }
  ```

### Edit Album
- **Endpoint**: `PUT /music/album.edit/:albumId`
- **Auth Required**: Yes (must be owner)
- **Body**:
  ```json
  {
    "title": "string",
    "artist": "string",
    "description": "string"
  }
  ```

### Delete Album
- **Endpoint**: `DELETE /music/album.delete/:albumId`
- **Auth Required**: Yes (must be owner)

## Track Management

### Get Track
- **Endpoint**: `GET /music/track/:trackId`
- **Auth Required**: No
- **Response**:
  ```json
  {
    "id": "number",
    "title": "string",
    "artist": "string",
    "track_image": "string" (URL),
    "album_id": "number"
  }
  ```

### Stream Track
- **Endpoint**: `GET /music/stream/:trackId`
- **Auth Required**: Yes
- **Headers**:
  - Optional: `Range: bytes=start-end`
- **Response**:
  - Status: 200 (full content) or 206 (partial content)
  - Content-Type: audio/mpeg
  - Supports byte range requests for seeking

## Playlist Management

### Create Playlist
- **Endpoint**: `POST /music/playlist.create`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "name": "string",
    "description": "string",
    "trackIds": "number[]"
  }
  ```

### Edit Playlist
- **Endpoint**: `PUT /music/playlist.edit/:playlistId`
- **Auth Required**: Yes (must be owner)
- **Body**:
  ```json
  {
    "name": "string",
    "description": "string"
  }
  ```

### Delete Playlist
- **Endpoint**: `DELETE /music/playlist.delete/:playlistId`
- **Auth Required**: Yes (must be owner)

### Add Track to Playlist
- **Endpoint**: `POST /music/playlist.addTrack`
- **Auth Required**: Yes (must be playlist owner)
- **Body**:
  ```json
  {
    "playlistId": "number",
    "trackId": "number"
  }
  ```

### Remove Track from Playlist
- **Endpoint**: `DELETE /music/playlist.removeTrack`
- **Auth Required**: Yes (must be playlist owner)
- **Body**:
  ```json
  {
    "playlistId": "number",
    "trackId": "number"
  }
  ```

## Favorite Management

### Favorite Album
- **Endpoint**: `POST /music/favourite.album`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "albumId": "number"
  }
  ```

### Unfavorite Album
- **Endpoint**: `DELETE /music/favourite.album/:albumId`
- **Auth Required**: Yes

### Favorite Track
- **Endpoint**: `POST /music/favourite.track`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "trackId": "number"
  }
  ```

### Unfavorite Track
- **Endpoint**: `DELETE /music/favourite.track/:trackId`
- **Auth Required**: Yes

### Favorite Artist
- **Endpoint**: `POST /music/favourite.artist`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "artistId": "number"
  }
  ```

### Unfavorite Artist
- **Endpoint**: `DELETE /music/favourite.artist/:artistId`
- **Auth Required**: Yes

## Profile Management

### Get User Profile
- **Endpoint**: `GET /profile.get`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "id": "number",
    "username": "string",
    "created_at": "string",
    "biography": "string",
    "profile_pic": "string" (URL)
  }
  ```

### Update User Profile
- **Endpoint**: `POST /profile.update`
- **Auth Required**: Yes
- **Content-Type**: `multipart/form-data`
- **Body**:
  ```
  biography: string
  profilePic: File (image)
  ```

### Get Artist Profile
- **Endpoint**: `GET /artist.getProfile`
- **Query Parameters**: `user_id`
- **Auth Required**: No
- **Response**:
  ```json
  {
    "user_id": "number",
    "stage_name": "string",
    "bio": "string",
    "profile_pic": "string" (URL),
    "albums": [
      {
        "id": "number",
        "title": "string",
        "artist": "string",
        "album_art": "string" (URL)
      }
    ],
    "tracks": [
      {
        "id": "number",
        "title": "string",
        "artist": "string",
        "track_image": "string" (URL)
      }
    ]
  }
  ```

### Update Artist Profile
- **Endpoint**: `POST /artist.updateProfile`
- **Auth Required**: Yes
- **Body**:
  ```json
  {
    "stage_name": "string",
    "bio": "string",
    "promoted_album": "number",
    "promoted_track": "number"
  }
  ```

## Search

### Search All
- **Endpoint**: `GET /search`
- **Query Parameters**: `q` (search term)
- **Auth Required**: No
- **Response**:
  ```json
  {
    "users": [
      {
        "id": "number",
        "username": "string",
        "profile_pic": "string" (URL)
      }
    ],
    "albums": [
      {
        "id": "number",
        "title": "string",
        "artist": "string",
        "album_art": "string" (URL)
      }
    ],
    "tracks": [
      {
        "id": "number",
        "title": "string",
        "artist": "string",
        "track_image": "string" (URL)
      }
    ]
  }
  ```

## Featured Content

### Get Featured Albums
- **Endpoint**: `GET /music.featuredAlbums`
- **Auth Required**: No
- **Response**:
  ```json
  {
    "featured": [
      {
        "id": "number",
        "title": "string",
        "artist": "string",
        "album_art": "string" (URL),
        "listens": "number"
      }
    ]
  }
  ```

## Recommendations

### Get Recommendations
- **Endpoint**: `GET /music.recommendations`
- **Auth Required**: Yes
- **Response**:
  ```json
  {
    "recommendations": [
      {
        "id": "number",
        "title": "string",
        "artist": "string",
        "album_art": "string" (URL)
      }
    ]
  }
  ```
- **Algorithm**: Based on:
  - User's favorited artists
  - Recent albums
  - Listening history

## Image Handling

### Get Image
- **Endpoint**: `GET /images/:folder/:imageName`
- **Auth Required**: No
- **Allowed Folders**:
  - albumArt
  - compressed
  - profilePics
- **Security**:
  - Path traversal protection
  - Folder whitelist
  - Normalized paths

### Image Processing
- Images are automatically processed upon upload
- EXIF data is stripped for privacy and security
- Supported formats: JPG, PNG, WebP
- Maximum file size: 5MB
- Recommended dimensions:
  - Profile pictures: 500x500px
  - Album art: 1000x1000px
  - Track art: 500x500px

### Image Storage Structure
```
uploads/
├── albumArt/
│   └── [timestamp]-[random]-[filename]
├── compressed/
│   └── [timestamp]-[random]-[filename]
└── profilePics/
    └── [timestamp]-[random]-[filename]
```

## Audio Processing

### Upload Specifications
- Supported formats: MP3, WAV, AAC, FLAC
- Maximum file size: 50MB per track
- Maximum tracks per album: 20
- Recommended specifications:
  - Sample rate: 44.1kHz
  - Bit depth: 16-bit
  - Channels: Stereo

### Audio Processing Pipeline
1. **Validation**
   - File type verification
   - Size check
   - Corruption check

2. **Compression**
   - Target bitrate: 128kbps
   - Format conversion to MP3 if needed
   - Metadata preservation

3. **Storage**
   - Organized in compressed directory
   - Original files are not retained
   - Unique filename generation

### Streaming Features
- Range request support (partial content)
- Adaptive bitrate streaming
- Buffer management
- Seek support
- Headers:
  ```http
  Accept-Ranges: bytes
  Content-Range: bytes start-end/total
  Content-Type: audio/mpeg
  Content-Length: size
  ```

## Security

### Authentication
- JWT-based authentication
- Token structure:
  ```json
  {
    "id": "user_id",
    "username": "username",
    "email": "email",
    "iat": "issued_at_timestamp",
    "exp": "expiration_timestamp"
  }
  ```
- Token expiration: 24 hours
- Refresh token functionality not implemented

### Authorization
- Role-based access control
- Owner-only operations for:
  - Album editing/deletion
  - Playlist management
  - Profile updates

### Security Measures
- Helmet middleware implementation
- CORS configuration
- Rate limiting:
  - 100 requests per minute per IP
  - Streaming endpoints: 1000 requests per hour
- SQL injection prevention
- XSS protection
- File upload validation
- Path traversal prevention

## Rate Limiting

### Global Limits
```javascript
{
  "standard": {
    "window": "60000ms",
    "max": 100
  },
  "streaming": {
    "window": "3600000ms",
    "max": 1000
  },
  "upload": {
    "window": "3600000ms",
    "max": 50
  }
}
```

### Endpoint-Specific Limits
- Authentication endpoints: 5 attempts per minute
- Search endpoints: 30 requests per minute
- Upload endpoints: 50 uploads per hour
- Download/streaming: 1000 requests per hour

## Error Codes

### HTTP Status Codes
- 200: Success
- 201: Created
- 204: No Content
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 413: Payload Too Large
- 415: Unsupported Media Type
- 429: Too Many Requests
- 500: Internal Server Error
- 503: Service Unavailable

### Custom Error Codes
```json
{
  "AUTH_001": "Invalid credentials",
  "AUTH_002": "Token expired",
  "AUTH_003": "Invalid token",
  "UPLOAD_001": "File too large",
  "UPLOAD_002": "Invalid file type",
  "UPLOAD_003": "Upload quota exceeded",
  "STREAM_001": "Track not found",
  "STREAM_002": "Invalid range header",
  "STREAM_003": "File not found on server"
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Profiles Table
```sql
CREATE TABLE user_profiles (
  user_id INT PRIMARY KEY,
  biography TEXT,
  profile_pic VARCHAR(255),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Albums Table
```sql
CREATE TABLE albums (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  description TEXT,
  album_art VARCHAR(255),
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  listens INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Tracks Table
```sql
CREATE TABLE tracks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  album_id INT,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  track_image VARCHAR(255),
  duration INT,
  FOREIGN KEY (album_id) REFERENCES albums(id)
);
```

### Playlists Table
```sql
CREATE TABLE playlists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Playlist Tracks Table
```sql
CREATE TABLE playlist_tracks (
  playlist_id INT,
  track_id INT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (playlist_id, track_id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id),
  FOREIGN KEY (track_id) REFERENCES tracks(id)
);
```

## Testing

### Test Coverage
- Unit tests
- Integration tests
- End-to-end tests
- Load testing for streaming endpoints

### Test Files Required
```
test/
├── setup.js
├── app.test.js
├── auth.test.js
├── upload.test.js
├── streaming.test.js
└── test_files/
    ├── sample_track.mp3
    ├── sample_album_art.jpg
    └── sample_profile_pic.jpg
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.js

# Run with coverage
npm test -- --coverage
```

## Deployment

### Requirements
- Node.js 14+
- MySQL 5.7+
- FFmpeg for audio processing
- ImageMagick for image processing

### Environment Variables
```bash
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=music_service
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

### Directory Structure
```
/var/www/beatfly-backend/
├── app/
│   └── [application files]
├── uploads/
│   ├── albumArt/
│   ├── compressed/
│   └── profilePics/
├── logs/
└── nginx/
    └── beatfly-backend.conf
```

### Monitoring
- CPU usage
- Memory usage
- Disk space
- Network traffic
- Error rates
- Response times
- Active connections
- Queue length
