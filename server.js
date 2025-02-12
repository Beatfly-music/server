const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import route modules.
const accountRoutes = require('./routes/accountRoutes');
const albumRoutes = require('./routes/albumRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const favouriteRoutes = require('./routes/favouriteRoutes');
const profileRoutes = require('./routes/profileRoutes');
const recommendationRoutes = require('./routes/recommendationRoutes');
const streamRoutes = require('./routes/streamRoutes');
const searchRoutes = require('./routes/searchRoutes');
const trackRoutes = require('./routes/trackRoutes');
const imageRoutes = require('./routes/imageRoutes');
const featuredRoutes = require('./routes/featuredRoutes'); // NEW: Featured routes

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (e.g. uploads)
app.use('/uploads', express.static('uploads'));

// Mount routes (using an XRPC‑style prefix).
app.use('/xrpc', accountRoutes);
app.use('/xrpc', albumRoutes);
app.use('/xrpc', playlistRoutes);
app.use('/xrpc', favouriteRoutes);
app.use('/xrpc', profileRoutes);
app.use('/xrpc', recommendationRoutes);
app.use('/xrpc', streamRoutes);
app.use('/xrpc', searchRoutes);
app.use('/xrpc', trackRoutes);
app.use('/xrpc', imageRoutes);
app.use('/xrpc', featuredRoutes); // NEW: Mount featured routes

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = server;
