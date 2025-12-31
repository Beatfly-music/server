// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const os = require('os');
const initSocket = require('./utils/socket');

const app = express();
const port = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Make NODE_ENV available in EJS templates
app.locals.env = NODE_ENV;

/* ---------------------------
   Setup View Engine & Assets
---------------------------- */
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use('/static', express.static(path.join(__dirname, 'public')));

/* ---------------------------
   Logger Configuration (Winston)
---------------------------- */
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log')
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/* ---------------------------
   Performance Monitor Setup
---------------------------- */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      cpu: Array(60).fill(0),
      memory: Array(60).fill(0),
      requests: Array(60).fill(0),
      errors: Array(60).fill(0),
      latency: Array(60).fill(0)
    };
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalLatency = 0;
    this.requestsThisInterval = 0;
    this.timestamp = Array(60).fill(0).map((_, i) => new Date(Date.now() - (59 - i) * 1000));
    this.recentRequests = [];
    this.recentErrors = [];
    this.startTime = Date.now();
  }

  recordRequest(req, res, duration) {
    this.requestCount++;
    this.requestsThisInterval++;
    const requestLog = {
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip
    };
    this.recentRequests.unshift(requestLog);
    if (this.recentRequests.length > 100) this.recentRequests.pop();
  }

  recordError(error, req) {
    this.errorCount++;
    const errorLog = {
      timestamp: new Date(),
      message: error.message,
      stack: error.stack,
      path: req?.path,
      method: req?.method
    };
    logger.error({
      message: error.message,
      method: req?.method,
      path: req?.path,
      stack: error.stack
    });
    console.error(`ERROR: ${error.message}`);
    this.recentErrors.unshift(errorLog);
    if (this.recentErrors.length > 100) this.recentErrors.pop();
  }

  getMetrics() {
    const cpuUsage = (os.loadavg()[0] * 100) / os.cpus().length;
    const usedMem = (os.totalmem() - os.freemem()) / 1024 / 1024;
    const avgLatency = this.requestsThisInterval > 0 ? this.totalLatency / this.requestsThisInterval : 0;

    // Slide the metrics arrays
    this.timestamp = [...this.timestamp.slice(1), new Date()];
    this.metrics.cpu = [...this.metrics.cpu.slice(1), cpuUsage];
    this.metrics.memory = [...this.metrics.memory.slice(1), usedMem];
    this.metrics.requests = [...this.metrics.requests.slice(1), this.requestCount];
    this.metrics.errors = [...this.metrics.errors.slice(1), this.errorCount];
    this.metrics.latency = [...this.metrics.latency.slice(1), avgLatency];

    const uptime = {
      total: Date.now() - this.startTime,
      days: Math.floor((Date.now() - this.startTime) / (1000 * 60 * 60 * 24)),
      hours: Math.floor(((Date.now() - this.startTime) % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor(((Date.now() - this.startTime) % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor(((Date.now() - this.startTime) % (1000 * 60)) / 1000)
    };

    // Reset interval counters
    this.requestCount = 0;
    this.errorCount = 0;
    this.totalLatency = 0;
    this.requestsThisInterval = 0;

    return {
      metrics: this.metrics,
      timestamp: this.timestamp,
      recentRequests: this.recentRequests,
      recentErrors: this.recentErrors,
      systemInfo: {
        uptime,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCores: os.cpus().length,
        platform: os.platform(),
        release: os.release(),
        nodeVersion: process.version,
        pid: process.pid
      }
    };
  }
}

const performanceMonitor = new PerformanceMonitor();

/* ---------------------------
   Global Resource Thresholds & Overload Check
---------------------------- */
let MAX_HEAP_USAGE = process.env.MAX_HEAP_USAGE ? Number(process.env.MAX_HEAP_USAGE) : 500 * 1024 * 1024; // 500 MB
let MAX_CPU_LOAD = process.env.MAX_CPU_LOAD ? Number(process.env.MAX_CPU_LOAD) : 0.8; // 80% per CPU

let highMemoryCount = 0;
let highCpuCount = 0;

setInterval(() => {
  const heapUsed = process.memoryUsage().heapUsed;
  if (global.gc && heapUsed > MAX_HEAP_USAGE) {
    console.log(`High memory usage detected: ${heapUsed} bytes. Triggering GC.`);
    global.gc();
    if (process.memoryUsage().heapUsed > MAX_HEAP_USAGE) {
      highMemoryCount++;
      logger.warn(`Memory usage remains high after GC.`);
    } else {
      highMemoryCount = 0;
    }
  } else {
    highMemoryCount = 0;
  }

  const load = os.loadavg()[0];
  if (load > os.cpus().length * MAX_CPU_LOAD) {
    highCpuCount++;
    logger.warn(`High CPU load detected: ${load}`);
  } else {
    highCpuCount = 0;
  }

  if (highMemoryCount >= 3 || highCpuCount >= 3) {
    logger.error(`Server overloaded. Initiating graceful shutdown.`);
    process.exit(1);
  }
}, 60000);

/* ---------------------------
   CORS Middleware Setup
---------------------------- */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Define allowed origins – update these as needed
    const allowedOrigins = [
      'https://player.beatfly-music.xyz',
      'https://experimental.beatfly-music.xyz',
      'http://localhost:3000'
    ];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  allowedHeaders: 'Content-Type, Authorization, X-Requested-With',
  credentials: true,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ---------------------------
   Other Middleware Setup
---------------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  })
);

app.use('/uploads', express.static('uploads'));

// Request tracking middleware (skip /metrics to reduce overhead)
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    if (req.path !== '/metrics') {
      performanceMonitor.recordRequest(req, res, duration);
    }
  });
  next();
});

/* ---------------------------
   Monitor Authentication Middleware
---------------------------- */
const authenticateMonitor = (req, res, next) => {
  if (req.session.authenticated) return next();
  if (req.headers.accept?.includes('application/json')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  res.redirect('/monitor/login');
};

/* ---------------------------
   Monitor Routes
---------------------------- */
app.get('/monitor/login', (req, res) => {
  res.render('login', { error: req.query.error });
});

app.post('/monitor/login', (req, res) => {
  const expectedPassword = process.env.MONITOR_PASSWORD || 'admin';
  if (req.body?.password === expectedPassword) {
    req.session.authenticated = true;
    return res.redirect('/monitor');
  }
  res.redirect('/monitor/login?error=1');
});

app.get('/monitor', authenticateMonitor, (req, res) => {
  res.render('monitor');
});

app.post('/monitor/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/monitor/login');
});

app.get('/metrics', authenticateMonitor, (req, res) => {
  res.json(performanceMonitor.getMetrics());
});

app.post('/monitor/gc', authenticateMonitor, (req, res) => {
  if (global.gc) {
    global.gc();
    res.json({ message: 'Garbage collection triggered.' });
  } else {
    res.status(500).json({ error: 'GC not available. Run Node with --expose-gc.' });
  }
});

app.post('/monitor/kill', authenticateMonitor, (req, res) => {
  logger.warn(`Emergency kill initiated. Shutting down server.`);
  res.json({ message: 'Emergency kill initiated. Server is shutting down.' });
  process.exit(1);
});

app.post('/monitor/setThresholds', authenticateMonitor, (req, res) => {
  const { maxHeapUsage, maxCpuLoad } = req.body;
  if (maxHeapUsage && !isNaN(maxHeapUsage)) {
    MAX_HEAP_USAGE = Number(maxHeapUsage);
  }
  if (maxCpuLoad && !isNaN(maxCpuLoad)) {
    MAX_CPU_LOAD = Number(maxCpuLoad);
  }
  res.json({
    message: 'Thresholds updated.',
    maxHeapUsage: MAX_HEAP_USAGE,
    maxCpuLoad: MAX_CPU_LOAD
  });
});

/* ---------------------------
   Mount Additional Application Routes
---------------------------- */
const routes = {
  account: require('./routes/accountRoutes'),
  album: require('./routes/albumRoutes'),
  playlist: require('./routes/playlistRoutes'),
  favourite: require('./routes/favouriteRoutes'),
  profile: require('./routes/profileRoutes'),
  recommendation: require('./routes/recommendationRoutes'),
  stream: require('./routes/streamRoutes'),
  search: require('./routes/searchRoutes'),
  track: require('./routes/trackRoutes'),
  image: require('./routes/imageRoutes'),
  featured: require('./routes/featuredRoutes'),
  user: require('./routes/userRoutes'),
  admin: require('./routes/adminRoutes'),
  report: require('./routes/reportRoutes')
};

Object.entries(routes).forEach(([name, router]) => {
  app.use('/xrpc', router);
  logger.info(`Mounted ${name} routes`);
});

/* ---------------------------
   Error Handling Middleware
---------------------------- */
app.use((err, req, res, next) => {
  performanceMonitor.recordError(err, req);
  if (req.xhr || req.headers.accept?.includes('application/json')) {
    res.status(500).json({
      error: 'Internal Server Error',
      message: NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
  } else {
    res.status(500).render('error', { error: err });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

/* ---------------------------
   Start Server & Graceful Shutdown
---------------------------- */
const server = app.listen(port, () => {
  console.log(`Server running on port ${port} (pid: ${process.pid})`);
  logger.info(`Server started on port ${port} (pid: ${process.pid})`);
});

// Initialize websocket server for playback syncing
const io = initSocket(server);
app.set('io', io);

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Closed out remaining connections.');
    logger.info('Closed out remaining connections.');
    process.exit(0);
  });
  // Force shutdown after 30 seconds if not closed
  setTimeout(() => {
    console.error('Forcing shutdown due to timeout.');
    logger.error('Forcing shutdown due to timeout.');
    process.exit(1);
  }, 30000);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  performanceMonitor.recordError(err);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', { reason, promise });
  performanceMonitor.recordError(new Error(`Unhandled Rejection: ${reason}`));
});

module.exports = server;
