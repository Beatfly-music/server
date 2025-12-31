const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { savePlaybackPosition, getPlaybackPosition, formatPlaybackState } = require('./playbackState');

/**
 * Initialize websocket server for playback sync.
 * Requires clients to pass a JWT token via `auth.token` or query param `token`.
 */
function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: [
        'https://player.beatfly-music.xyz',
        'https://experimental.beatfly-music.xyz',
        'http://localhost:3000'
      ],
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Unauthorized'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.emit('playback:connected', { userId });

    socket.on('playback:sync', async (payload = {}) => {
      try {
        const { trackId, positionSeconds, isPaused = false } = payload;
        if (!trackId || positionSeconds === undefined) {
          return;
        }
        await savePlaybackPosition({
          userId,
          trackId,
          positionSeconds: Number(positionSeconds) || 0,
          isPaused: Boolean(isPaused)
        });
        socket.emit('playback:ack', {
          trackId,
          positionSeconds: Number(positionSeconds) || 0,
          isPaused: Boolean(isPaused)
        });
      } catch (err) {
        console.error('playback:sync error', err.message);
        socket.emit('playback:error', { message: 'Failed to save playback position' });
      }
    });

    socket.on('playback:request', async () => {
      try {
        const state = await getPlaybackPosition(userId);
        socket.emit('playback:state', formatPlaybackState(state));
      } catch (err) {
        console.error('playback:request error', err.message);
        socket.emit('playback:error', { message: 'Failed to load playback state' });
      }
    });
  });

  return io;
}

module.exports = initSocket;
