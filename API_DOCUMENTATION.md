# BeatFly API Documentation

Base URL: `/xrpc/`

All authenticated endpoints require the `Authorization: Bearer <token>` header.

---

## Table of Contents

- [Authentication](#authentication)
- [User Management](#user-management)
- [Profiles](#profiles)
- [Albums](#albums)
- [Tracks](#tracks)
- [Playlists](#playlists)
- [Favorites](#favorites)
- [Streaming](#streaming)
- [Search](#search)
- [Recommendations](#recommendations)
- [Featured Content](#featured-content)
- [User Settings & Preferences](#user-settings--preferences)
- [Year in Review](#year-in-review)
- [Reports](#reports)
- [Admin Endpoints](#admin-endpoints)

---

## Authentication

### Register
```
POST /xrpc/account.register
```
**Body:**
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```
**Response:** `{ "userId": 123456 }`

### Login
```
POST /xrpc/account.login
```
**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```
**Response:** `{ "token": "jwt_token_here" }`

### Get Profile
```
GET /xrpc/account.profile
```
**Auth Required:** Yes
**Response:** User profile with creation date

### Forgot Password
```
POST /xrpc/account.forgotPassword
```
**Body:**
```json
{
  "email": "string"
}
```
Sends a password reset email with a 15-minute expiration token.

### Reset Password
```
POST /xrpc/account.resetPassword
```
**Body:**
```json
{
  "token": "reset_token",
  "newPassword": "string"
}
```

---

## User Management

### Get Settings
```
GET /xrpc/user.settings
```
**Auth Required:** Yes
**Response:**
```json
{
  "settings": {
    "allow_explicit": 1,
    "autoplay": 1,
    "share_activity": 1,
    "theme": "system",
    "language": "en",
    "updated_at": "timestamp"
  }
}
```

### Update Settings
```
PATCH /xrpc/user.settings
```
**Auth Required:** Yes
**Body:** (all fields optional)
```json
{
  "allow_explicit": true,
  "autoplay": true,
  "share_activity": true,
  "theme": "dark",
  "language": "en"
}
```

### Dislike Track
```
POST /xrpc/user.dislike.track
```
**Auth Required:** Yes
**Body:**
```json
{
  "trackId": 123
}
```

### Remove Dislike
```
DELETE /xrpc/user.dislike.track/:trackId
```
**Auth Required:** Yes

### Get Disliked Tracks
```
GET /xrpc/user.dislike.tracks
```
**Auth Required:** Yes
**Response:**
```json
{
  "tracks": [
    {
      "trackId": 123,
      "title": "string",
      "artist": "string",
      "dislikedAt": "timestamp",
      "track_image": "url"
    }
  ]
}
```

### Block Artist
```
POST /xrpc/user.block.artist
```
**Auth Required:** Yes
**Body:**
```json
{
  "artistId": 123
}
```

### Unblock Artist
```
DELETE /xrpc/user.block.artist/:artistId
```
**Auth Required:** Yes

### Get Blocked Artists
```
GET /xrpc/user.blocked.artists
```
**Auth Required:** Yes
**Response:**
```json
{
  "artists": [
    {
      "artistId": 123,
      "stage_name": "string",
      "username": "string",
      "blockedAt": "timestamp"
    }
  ]
}
```

### Get Playback State
```
GET /xrpc/user.playback.state
```
**Auth Required:** Yes
**Response:** Current playback position and track

### Save Playback State
```
POST /xrpc/user.playback.state
```
**Auth Required:** Yes
**Body:**
```json
{
  "trackId": 123,
  "positionSeconds": 45,
  "isPaused": false
}
```

---

## Profiles

### Get User Profile
```
GET /xrpc/profile.user/:userId
```
**Response:** User profile information

### Update User Profile
```
PATCH /xrpc/profile.user
```
**Auth Required:** Yes
**Body:**
```json
{
  "biography": "string",
  "profile_pic": "file"
}
```

### Get Artist Profile
```
GET /xrpc/profile.artist/:artistId
```
**Response:** Artist profile with albums and tracks

### Update Artist Profile
```
PATCH /xrpc/profile.artist
```
**Auth Required:** Yes
**Body:**
```json
{
  "stage_name": "string",
  "bio": "string",
  "promoted_album": 123,
  "promoted_track": 456
}
```

---

## Albums

### Create Album
```
POST /xrpc/album.create
```
**Auth Required:** Yes
**Body (multipart/form-data):**
- `title`: string
- `description`: string (optional)
- `isExplicit`: boolean (optional)
- `albumArt`: file (optional)

### Get Album
```
GET /xrpc/album.get/:albumId
```
**Response:** Album details with tracks

### Edit Album
```
PATCH /xrpc/album.edit/:albumId
```
**Auth Required:** Yes (owner only)
**Body:**
```json
{
  "title": "string",
  "description": "string",
  "isExplicit": true
}
```

### Delete Album
```
DELETE /xrpc/album.delete/:albumId
```
**Auth Required:** Yes (owner only)
Cascades: Deletes all tracks and associated files

### Add Track to Album
```
POST /xrpc/album.addtrack/:albumId
```
**Auth Required:** Yes (owner only)
**Body (multipart/form-data):**
- `title`: string
- `trackFile`: audio file
- `trackImage`: file (optional)
- `lyrics`: string (optional)

### Delete Track from Album
```
DELETE /xrpc/album.deletetrack/:albumId/:trackId
```
**Auth Required:** Yes (owner only)

---

## Tracks

### Get Track
```
GET /xrpc/track.get/:trackId
```
**Response:** Track metadata including album info

---

## Playlists

### Create Playlist
```
POST /xrpc/playlist.create
```
**Auth Required:** Yes
**Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

### Get Playlist
```
GET /xrpc/playlist.get/:playlistId
```
**Auth Required:** Yes (owner only)
**Response:** Playlist with all tracks

### Get All User Playlists
```
GET /xrpc/playlist.all
```
**Auth Required:** Yes
**Response:** List of user's playlists

### Edit Playlist
```
PATCH /xrpc/playlist.edit/:playlistId
```
**Auth Required:** Yes (owner only)
**Body:**
```json
{
  "name": "string",
  "description": "string"
}
```

### Delete Playlist
```
DELETE /xrpc/playlist.delete/:playlistId
```
**Auth Required:** Yes (owner only)

### Add Track to Playlist
```
POST /xrpc/playlist.addtrack/:playlistId
```
**Auth Required:** Yes (owner only)
**Body:**
```json
{
  "trackId": 123
}
```

### Remove Track from Playlist
```
DELETE /xrpc/playlist.removetrack/:playlistId/:trackId
```
**Auth Required:** Yes (owner only)

---

## Favorites

### Favorite Album
```
POST /xrpc/favourite.album
```
**Auth Required:** Yes
**Body:**
```json
{
  "albumId": 123
}
```

### Unfavorite Album
```
DELETE /xrpc/favourite.album/:albumId
```
**Auth Required:** Yes

### Get Favorite Albums
```
GET /xrpc/favourite.albums
```
**Auth Required:** Yes

### Favorite Track
```
POST /xrpc/favourite.track
```
**Auth Required:** Yes
**Body:**
```json
{
  "trackId": 123
}
```

### Unfavorite Track
```
DELETE /xrpc/favourite.track/:trackId
```
**Auth Required:** Yes

### Get Favorite Tracks
```
GET /xrpc/favourite.tracks
```
**Auth Required:** Yes

### Favorite Artist
```
POST /xrpc/favourite.artist
```
**Auth Required:** Yes
**Body:**
```json
{
  "artistId": 123
}
```

### Unfavorite Artist
```
DELETE /xrpc/favourite.artist/:artistId
```
**Auth Required:** Yes

### Get Favorite Artists
```
GET /xrpc/favourite.artists
```
**Auth Required:** Yes

---

## Streaming

### Stream Track
```
GET /xrpc/stream/:trackId
```
**Auth Required:** Yes
Streams audio with segmentation. Enforces 12-hour duplicate listen prevention.

---

## Search

### Search
```
GET /xrpc/search
```
**Query Parameters:**
- `q`: search query (required)
- `type`: `tracks`, `albums`, `artists`, or `all` (default: `all`)
- `limit`: number (default: 20)
- `offset`: number (default: 0)

**Response:**
```json
{
  "tracks": [...],
  "albums": [...],
  "artists": [...]
}
```

---

## Recommendations

### Get Recommendations
```
GET /xrpc/recommendations
```
**Auth Required:** Yes
**Response:** Personalized track recommendations based on listening history

---

## Featured Content

### Get Featured
```
GET /xrpc/featured
```
**Response:** Featured albums and tracks

---

## Year in Review

### Get Year in Review
```
GET /xrpc/user.yearinreview
```
**Auth Required:** Yes
**Availability:** December only (returns 403 in Jan-Nov)
**Behavior:**
- First request in December generates and saves the review
- Creates a playlist called "Your {year} Wrapped" from top tracks
- Subsequent requests return the saved snapshot

**Response:**
```json
{
  "year": 2025,
  "summary": {
    "totalListens": 1234,
    "uniqueTracks": 256,
    "firstListen": "timestamp",
    "lastListen": "timestamp",
    "topArtist": "Artist Name"
  },
  "topTracks": [
    {
      "trackId": 123,
      "title": "string",
      "artist": "string",
      "album": "string",
      "listenCount": 45,
      "track_image": "url"
    }
  ],
  "topArtists": [
    {
      "artist": "string",
      "listenCount": 100
    }
  ],
  "favouritesAdded": [...],
  "recentDislikes": [...],
  "blockedArtists": [...],
  "playlistId": 123456,
  "generatedAt": "timestamp",
  "isNewGeneration": true
}
```

**Error (not December):**
```json
{
  "error": "Year in Review is only available in December",
  "availableIn": "December"
}
```

---

## Reports

### Report Artist
```
POST /xrpc/report.artist
```
**Auth Required:** Yes
**Body:**
```json
{
  "artistID": 123,
  "category": "Copyright",
  "description": "Optional description"
}
```

**Valid Categories:**
- `Copyright`
- `Inappropriate Content`
- `Spam`
- `Harassment`
- `Impersonation`
- `Fraud`
- `Other`

**Rate Limit:** One report per artist per category per 24 hours

**Response:**
```json
{
  "message": "Report submitted successfully",
  "report": {
    "id": 1,
    "artistId": 123,
    "artistName": "Artist Name",
    "category": "Copyright",
    "description": "...",
    "status": "pending",
    "createdAt": "timestamp"
  }
}
```

### Get My Reports
```
GET /xrpc/report.myreports
```
**Auth Required:** Yes
**Query Parameters:**
- `limit`: number (default: 20)
- `offset`: number (default: 0)

**Response:**
```json
{
  "reports": [
    {
      "id": 1,
      "artist_id": 123,
      "category": "Copyright",
      "description": "...",
      "status": "pending",
      "created_at": "timestamp",
      "stage_name": "Artist Name"
    }
  ]
}
```

---

## Admin Endpoints

All admin endpoints require authentication and admin privileges.

### Dashboard & Statistics

#### Get Platform Stats
```
GET /xrpc/admin/stats
```
**Response:**
```json
{
  "stats": {
    "users": 1000,
    "artists": 150,
    "albums": 500,
    "tracks": 3000,
    "playlists": 800,
    "bannedUsers": 5,
    "bannedArtists": 2,
    "pendingReports": 10
  }
}
```

#### Get All Users
```
GET /xrpc/admin/users
```
**Query Parameters:**
- `limit`: number (default: 50)
- `offset`: number (default: 0)
- `search`: string (searches username/email)

**Response:**
```json
{
  "users": [
    {
      "id": 123,
      "username": "string",
      "email": "string",
      "is_admin": 0,
      "created_at": "timestamp",
      "biography": "string",
      "profile_pic": "string",
      "is_artist": 1,
      "is_banned": 0
    }
  ]
}
```

#### Get All Artists
```
GET /xrpc/admin/artists
```
**Query Parameters:**
- `limit`: number (default: 50)
- `offset`: number (default: 0)
- `search`: string (searches stage_name/username)

**Response:**
```json
{
  "artists": [
    {
      "artistId": 123,
      "stage_name": "string",
      "bio": "string",
      "username": "string",
      "email": "string",
      "created_at": "timestamp",
      "is_banned": 0,
      "album_count": 5,
      "track_count": 25
    }
  ]
}
```

#### Get User Overview
```
GET /xrpc/admin/user/:userId/overview
```
**Response:** Detailed user info including settings, playback state, and stats

#### Get User Year in Review (Admin)
```
GET /xrpc/admin/user/:userId/yearinreview
```
**Query Parameters:**
- `year`: number (default: current year)

**Response:** Year in review data for any user (no December restriction)

---

### User Management

#### Ban User
```
POST /xrpc/admin/user/ban
```
**Body:**
```json
{
  "userId": 123,
  "reason": "Violation of terms",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```
- `expiresAt` is optional (null = permanent ban)
- Cannot ban yourself or other admins

**Response:**
```json
{
  "message": "User banned successfully",
  "user": { "userId": 123, "username": "string" },
  "reason": "...",
  "expiresAt": "timestamp or 'permanent'"
}
```

#### Unban User
```
DELETE /xrpc/admin/user/ban/:userId
```
**Response:**
```json
{
  "message": "User unbanned successfully",
  "userId": 123
}
```

#### Get Banned Users
```
GET /xrpc/admin/user/banned
```
**Response:**
```json
{
  "bannedUsers": [
    {
      "user_id": 123,
      "reason": "string",
      "banned_at": "timestamp",
      "expires_at": "timestamp or null",
      "username": "string",
      "email": "string",
      "banned_by_username": "admin_name"
    }
  ]
}
```

#### Delete User
```
DELETE /xrpc/admin/user/:userId
```
- Cannot delete yourself or other admins
- Cascades: Deletes all user data

**Response:**
```json
{
  "message": "User deleted successfully",
  "userId": 123,
  "username": "string"
}
```

---

### Artist Management

#### Ban Artist
```
POST /xrpc/admin/artist/ban
```
**Body:**
```json
{
  "artistId": 123,
  "reason": "Copyright violations",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "message": "Artist banned successfully",
  "artist": {
    "artistId": 123,
    "stage_name": "string",
    "username": "string"
  },
  "reason": "...",
  "expiresAt": "timestamp or 'permanent'"
}
```

#### Unban Artist
```
DELETE /xrpc/admin/artist/ban/:artistId
```
**Response:**
```json
{
  "message": "Artist unbanned successfully",
  "artistId": 123
}
```

#### Get Banned Artists
```
GET /xrpc/admin/artist/banned
```
**Response:**
```json
{
  "bannedArtists": [
    {
      "artist_id": 123,
      "reason": "string",
      "banned_at": "timestamp",
      "expires_at": "timestamp or null",
      "stage_name": "string",
      "username": "string",
      "banned_by_username": "admin_name"
    }
  ]
}
```

---

### Content Management

#### Rename/Edit Album
```
PATCH /xrpc/admin/album/:albumId
```
**Body:** (at least one field required)
```json
{
  "title": "New Title",
  "artist": "New Artist Name",
  "description": "New description"
}
```

**Response:**
```json
{
  "message": "Album updated successfully",
  "album": { ...updated album object }
}
```

#### Delete Album
```
DELETE /xrpc/admin/album/:albumId
```
- Deletes album, all tracks, and associated files

**Response:**
```json
{
  "message": "Album deleted successfully",
  "albumId": 123,
  "title": "Album Title"
}
```

#### Rename/Edit Track
```
PATCH /xrpc/admin/track/:trackId
```
**Body:** (at least one field required)
```json
{
  "title": "New Title",
  "artist": "New Artist Name",
  "lyrics": "New lyrics"
}
```

**Response:**
```json
{
  "message": "Track updated successfully",
  "track": { ...updated track object }
}
```

#### Delete Track
```
DELETE /xrpc/admin/track/:trackId
```
- Deletes track and associated files

**Response:**
```json
{
  "message": "Track deleted successfully",
  "trackId": 123,
  "title": "Track Title"
}
```

---

### Report Management

#### Get Reports
```
GET /xrpc/admin/reports
```
**Query Parameters:**
- `status`: `pending`, `reviewed`, `resolved`, `dismissed` (optional)
- `artistId`: number (optional)
- `limit`: number (default: 50)
- `offset`: number (default: 0)

**Response:**
```json
{
  "reports": [
    {
      "id": 1,
      "artist_id": 123,
      "reporter_id": 456,
      "category": "Copyright",
      "description": "...",
      "status": "pending",
      "reviewed_by": null,
      "reviewed_at": null,
      "created_at": "timestamp",
      "stage_name": "Artist Name",
      "reporter_username": "user123",
      "reviewer_username": null
    }
  ]
}
```

#### Update Report Status
```
PATCH /xrpc/admin/report/:reportId
```
**Body:**
```json
{
  "status": "resolved"
}
```

**Valid Statuses:**
- `pending`
- `reviewed`
- `resolved`
- `dismissed`

**Response:**
```json
{
  "message": "Report status updated",
  "report": { ...updated report object }
}
```

---

## Error Responses

### Banned User
When a banned user tries to authenticate:
```json
{
  "error": "Account banned",
  "reason": "Violation of terms of service",
  "expiresAt": "2025-12-31T23:59:59Z"
}
```
**Status:** 403 Forbidden

### Authentication Required
```json
{
  "error": "Authorization header missing"
}
```
**Status:** 401 Unauthorized

### Admin Access Required
```json
{
  "error": "Admin access required"
}
```
**Status:** 403 Forbidden

### Not Found
```json
{
  "error": "Resource not found"
}
```
**Status:** 404 Not Found

### Rate Limited
```json
{
  "error": "You have already reported this artist for this reason recently",
  "retryAfter": "24 hours"
}
```
**Status:** 429 Too Many Requests

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (id, username, email, password, is_admin) |
| `user_profiles` | Extended user info (biography, profile_pic) |
| `artist_profiles` | Artist-specific data (stage_name, bio, promoted content) |
| `albums` | Album metadata (title, artist, album_art, listens, isExplicit) |
| `tracks` | Track data (album_id, title, file_path, track_image, listens, lyrics) |
| `playlists` | User playlists |
| `playlist_tracks` | Playlist-track associations |
| `favourite_albums` | User album favorites |
| `favourite_tracks` | User track favorites |
| `favourite_artists` | User artist favorites |
| `listens` | Listen history (12-hour duplicate prevention) |
| `user_settings` | User preferences |
| `disliked_tracks` | Tracks users disliked |
| `blocked_artists` | Artists users blocked |
| `playback_positions` | Resume playback positions |
| `streaming_sessions` | Active streaming sessions |
| `year_in_review_snapshots` | Generated year reviews (one per user per year) |
| `banned_users` | User bans with expiration |
| `banned_artists` | Artist bans with expiration |
| `artist_reports` | User-submitted reports against artists |

---

## WebSocket Events

Connection: `wss://server/` with JWT auth

| Event | Direction | Purpose |
|-------|-----------|---------|
| `playback:sync` | Client -> Server | Save playback position |
| `playback:request` | Client -> Server | Request saved position |
| `playback:ack` | Server -> Client | Confirmation response |
| `playback:error` | Server -> Client | Error response |
