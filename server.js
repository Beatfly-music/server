const express = require('express');
const cors = require('cors');
require('dotenv').config();
const blessed = require('blessed');
const os = require('os');

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

/**
 * Helper function to extract a human-readable route string from Express’s internal RegExp.
 * @param {RegExp} regexp - The regular expression from a router layer.
 * @returns {string} - The extracted path.
 */
function extractRoute(regexp) {
  let route = regexp.toString();
  route = route
    .replace('/^\\', '')
    .replace('\\/?(?=\\/|$)/i', '')
    .replace('$/i', '')
    .replace('/i', '');
  return route;
}

/**
 * Traverses the Express app’s internal router stack to collect route information.
 * Returns an array of objects with the HTTP methods and full path.
 * @param {object} app - The Express app instance.
 * @param {string} [mountPath=''] - An optional mount path to prepend.
 * @returns {Array} - Array of route objects: { methods, path }.
 */
function listRoutes(app, mountPath = '') {
  let routes = [];
  if (!app._router) return routes;

  app._router.stack.forEach((layer) => {
    // If the layer directly represents a route.
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .map((method) => method.toUpperCase())
        .join(', ');
      routes.push({ methods, path: mountPath + layer.route.path });
    }
    // If the layer is a mounted router.
    else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      const currentMountPath =
        mountPath +
        (layer.regexp && layer.regexp.source !== '^\\/?$'
          ? extractRoute(layer.regexp)
          : '');
      layer.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods)
            .map((method) => method.toUpperCase())
            .join(', ');
          routes.push({ methods, path: currentMountPath + handler.route.path });
        }
      });
    }
  });

  return routes;
}

// Expose a JSON endpoint that returns the routes.
app.get('/routes', (req, res) => {
  const routesData = listRoutes(app, '/xrpc');
  res.json(routesData);
});

let routesData = [];

// Start the server.
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);

  // After the server has loaded, extract routes (all routes are mounted under "/xrpc").
  routesData = listRoutes(app, '/xrpc');
  console.log('Registered Routes:');
  routesData.forEach((route) => {
    console.log(`${route.methods} ${route.path}`);
  });

  // === Initialize Blessed Terminal Dashboard ===

  // Create the screen.
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Server Dashboard'
  });

  // Create a "Details" box with server info and instructions.
  const detailsBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    content: `Server Details:
---------------------------
Port: ${port}
Total Routes: ${routesData.length}

Controls:
  {bold}d{/bold} - Details View
  {bold}r{/bold} - Routes (JSON) View
  {bold}u{/bold} - Resource Usage View
  {bold}q{/bold} - Quit

Use arrow keys or PageUp/PageDown to scroll where applicable.`,
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  });

  // Create a "Routes" box displaying the routes as formatted JSON.
  const routesBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    content: JSON.stringify(routesData, null, 2),
    tags: true,
    border: { type: 'line' },
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    hidden: true,
    style: { border: { fg: 'green' } }
  });

  // Create a "Resource Usage" box.
  const resourceBox = blessed.box({
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    content: 'Loading resource usage...',
    tags: true,
    border: { type: 'line' },
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    hidden: true,
    style: { border: { fg: 'magenta' } }
  });

  // Append all boxes to the screen.
  screen.append(detailsBox);
  screen.append(routesBox);
  screen.append(resourceBox);

  // Function to update the resource usage information.
  function updateResourceUsage() {
    const memUsage = process.memoryUsage();
    const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
    const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
    const external = (memUsage.external / 1024 / 1024).toFixed(2);

    const totalMem = (os.totalmem() / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024).toFixed(2);
    const usedMemPercentage = (((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2);

    const loadavg = os.loadavg(); // [1min, 5min, 15min]
    const uptime = process.uptime().toFixed(2);

    const content = `Resource Usage:
---------------------------
Process Memory (MB):
  RSS       : ${rss}
  Heap Used : ${heapUsed}
  Heap Total: ${heapTotal}
  External  : ${external}

System Memory (MB):
  Total     : ${totalMem}
  Free      : ${freeMem}
  Used %    : ${usedMemPercentage}%

CPU Load Average:
  1 min: ${loadavg[0].toFixed(2)}
  5 min: ${loadavg[1].toFixed(2)}
 15 min: ${loadavg[2].toFixed(2)}

Process Uptime: ${uptime} seconds

Scroll with arrow keys or PageUp/PageDown.
Press {bold}d{/bold} for Details, {bold}r{/bold} for Routes, {bold}u{/bold} for Resource Usage.
`;
    resourceBox.setContent(content);
    screen.render();
  }

  // Update resource usage every second.
  const resourceInterval = setInterval(updateResourceUsage, 1000);

  // --- Keyboard Controls ---

  // Switch to Details view.
  screen.key(['d'], () => {
    detailsBox.show();
    routesBox.hide();
    resourceBox.hide();
    screen.render();
  });

  // Switch to Routes view.
  screen.key(['r'], () => {
    // Refresh routes data when switching to the Routes view.
    const updatedRoutes = listRoutes(app, '/xrpc');
    routesBox.setContent(JSON.stringify(updatedRoutes, null, 2));
    detailsBox.hide();
    routesBox.show();
    resourceBox.hide();
    screen.render();
  });

  // Switch to Resource Usage view.
  screen.key(['u'], () => {
    detailsBox.hide();
    routesBox.hide();
    resourceBox.show();
    screen.render();
  });

  // Quit the dashboard.
  screen.key(['q', 'C-c'], () => {
    clearInterval(resourceInterval);
    process.exit(0);
  });

  screen.render();
});

module.exports = server;
