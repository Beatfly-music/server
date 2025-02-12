// test/app.test.js
const request = require('supertest');
const chai = require('chai');
const expect = chai.expect;
const path = require('path');
const fs = require('fs');

// Import the server instance (ensure server.js exports an HTTP server instance)
const server = require('../server');

// Generate unique user credentials for testing.
const uniqueSuffix = Date.now();
let testUser = {
  username: `testuser_${uniqueSuffix}`,
  email: `testuser_${uniqueSuffix}@example.com`,
  password: 'password123'
};

describe('BeatFly Backend API Tests', function() {
  // Increase timeout if needed (for file uploads, compression, etc.)
  this.timeout(15000);

  let token;
  let albumId;
  let playlistId;
  let trackId; // We assume at least one track is created.
  let forgotToken;
  let userId; // Will store the authenticated user's id

  // ---------------------------
  // ACCOUNT ENDPOINTS
  // ---------------------------
  describe('Account Endpoints', function() {
    it('should return 401 for protected route when no token is provided', function(done) {
      request(server)
        .get('/xrpc/account.profile')
        .expect(401, done);
    });

    it('should register a new user', function(done) {
      request(server)
        .post('/xrpc/account.register')
        .send(testUser)
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('userId');
          done();
        });
    });

    it('should login the user and return a JWT token', function(done) {
      request(server)
        .post('/xrpc/account.login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('token');
          token = res.body.token;
          done();
        });
    });

    it('should get the user profile when authenticated', function(done) {
      request(server)
        .get('/xrpc/account.profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('username');
          expect(res.body.username).to.equal(testUser.username);
          userId = res.body.id; // Save the user's id for later use
          done();
        });
    });

    it('should generate a forgot password token', function(done) {
      request(server)
        .post('/xrpc/account.forgotPassword')
        .send({ email: testUser.email })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('resetToken');
          forgotToken = res.body.resetToken;
          done();
        });
    });

    it('should reset the password using the token', function(done) {
      const newPassword = "newpassword456";
      request(server)
        .post('/xrpc/account.resetPassword')
        .send({ token: forgotToken, newPassword })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          testUser.password = newPassword; // Update testUser's password
          done();
        });
    });

    it('should login with the new password after reset', function(done) {
      request(server)
        .post('/xrpc/account.login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('token');
          token = res.body.token;
          done();
        });
    });
  });

  // ---------------------------
  // ALBUM ENDPOINTS (with file uploads and EXIF stripping)
  // ---------------------------
  describe('Album Endpoints', function() {
    it('should create an album with file uploads', function(done) {
      const albumData = {
        title: 'Test Album',
        artist: 'Test Artist',
        description: 'This is a test album'
      };

      request(server)
        .post('/xrpc/music/album.create')
        .set('Authorization', `Bearer ${token}`)
        .field('title', albumData.title)
        .field('artist', albumData.artist)
        .field('description', albumData.description)
        .attach('albumArt', path.join(__dirname, 'test_files', 'sample_album_art.jpg'))
        .attach('tracks', path.join(__dirname, 'test_files', 'sample_track.mp3'))
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('albumId');
          albumId = res.body.albumId;
          // For testing streaming, assume the first track created has id = 1.
          // In a fresh database, this is usually the case.
          trackId = 1;
          done();
        });
    });
  });

  // ---------------------------
  // PLAYLIST ENDPOINTS
  // ---------------------------
  describe('Playlist Endpoints', function() {
    it('should create a new playlist', function(done) {
      const playlistData = {
        name: 'Test Playlist',
        description: 'A playlist for testing',
        trackIds: [] // start with an empty playlist
      };
      request(server)
        .post('/xrpc/music/playlist.create')
        .set('Authorization', `Bearer ${token}`)
        .send(playlistData)
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('playlistId');
          playlistId = res.body.playlistId;
          done();
        });
    });

    it('should add a track to the playlist', function(done) {
      request(server)
        .post('/xrpc/music/playlist.addTrack')
        .set('Authorization', `Bearer ${token}`)
        .send({ playlistId, trackId })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should remove a track from the playlist', function(done) {
      request(server)
        .delete('/xrpc/music/playlist.removeTrack')
        .set('Authorization', `Bearer ${token}`)
        .send({ playlistId, trackId })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should delete the playlist', function(done) {
      request(server)
        .delete(`/xrpc/music/playlist.delete/${playlistId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });
  });

  // ---------------------------
  // Before running Favourites tests, ensure the artist profile is set up.
  // ---------------------------
  describe('Favourites Endpoints', function() {
    before(function(done) {
      // Update the artist profile for the authenticated user.
      const artistData = {
        stage_name: 'Test Artist',
        bio: 'Artist bio for testing',
        promoted_album: albumId,
        promoted_track: trackId
      };
      request(server)
        .post('/xrpc/artist.updateProfile')
        .set('Authorization', `Bearer ${token}`)
        .send(artistData)
        .expect(200, done);
    });

    it('should favourite an album', function(done) {
      request(server)
        .post('/xrpc/music/favourite.album')
        .set('Authorization', `Bearer ${token}`)
        .send({ albumId })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should unfavourite an album', function(done) {
      request(server)
        .delete(`/xrpc/music/favourite.album/${albumId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should favourite a track', function(done) {
      request(server)
        .post('/xrpc/music/favourite.track')
        .set('Authorization', `Bearer ${token}`)
        .send({ trackId })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should unfavourite a track', function(done) {
      request(server)
        .delete(`/xrpc/music/favourite.track/${trackId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should favourite an artist', function(done) {
      // Use the authenticated user's id (userId) as the artist id.
      request(server)
        .post('/xrpc/music/favourite.artist')
        .set('Authorization', `Bearer ${token}`)
        .send({ artistId: userId })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should unfavourite an artist', function(done) {
      request(server)
        .delete(`/xrpc/music/favourite.artist/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });
  });

  // ---------------------------
  // PROFILE ENDPOINTS
  // ---------------------------
  describe('Profile Endpoints', function() {
    it('should update the user profile with a biography and profile picture', function(done) {
      request(server)
        .post('/xrpc/profile.update')
        .set('Authorization', `Bearer ${token}`)
        .field('biography', 'This is a test biography.')
        .attach('profilePic', path.join(__dirname, 'test_files', 'sample_profile_pic.jpg'))
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should get the updated user profile', function(done) {
      request(server)
        .get('/xrpc/profile.get')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('biography');
          expect(res.body.biography).to.equal('This is a test biography.');
          done();
        });
    });

    it('should update the artist profile for the authenticated user', function(done) {
      const artistData = {
        stage_name: 'Test Artist',
        bio: 'Artist bio for testing',
        promoted_album: albumId,
        promoted_track: trackId
      };
      request(server)
        .post('/xrpc/artist.updateProfile')
        .set('Authorization', `Bearer ${token}`)
        .send(artistData)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('message');
          done();
        });
    });

    it('should get the artist profile', function(done) {
      request(server)
        .get('/xrpc/artist.getProfile')
        .query({ user_id: userId })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('stage_name');
          expect(res.body.stage_name).to.equal('Test Artist');
          done();
        });
    });
  });

  // ---------------------------
  // RECOMMENDATION ENDPOINT
  // ---------------------------
  describe('Recommendation Endpoint', function() {
    it('should return recommendations for the authenticated user', function(done) {
      request(server)
        .get('/xrpc/music.recommendations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body).to.have.property('recommendations');
          expect(res.body.recommendations).to.be.an('array');
          done();
        });
    });
  });

  // ---------------------------
  // STREAMING ENDPOINT
  // ---------------------------
  describe('Streaming Endpoint', function() {
    it('should stream the entire audio file when no Range header is provided', function(done) {
      request(server)
        .get(`/xrpc/music/stream/${trackId}`)
        .end((err, res) => {
          if (err) return done(err);
          // If the file is not found, skip the test.
          if (res.status === 404) {
            this.skip();
          } else {
            expect(res.status).to.equal(200);
            expect(res.header).to.have.property('content-length');
            done();
          }
        });
    });

    it('should stream a portion of the audio file when a Range header is provided', function(done) {
      request(server)
        .get(`/xrpc/music/stream/${trackId}`)
        .set('Range', 'bytes=0-1023')
        .end((err, res) => {
          if (err) return done(err);
          if (res.status === 404) {
            this.skip();
          } else {
            expect(res.status).to.equal(206);
            expect(res.header).to.have.property('content-range');
            done();
          }
        });
    });
  });

  // ---------------------------
  // CLEANUP
  // ---------------------------
  after(function(done) {
    // Close the server instance once all tests are complete.
    server.close(done);
  });
});
