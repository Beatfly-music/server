# WebSocket Documentation

This server exposes a Socket.IO endpoint for syncing playback progress so users can resume tracks where they left off. Connections run on the same host/port as the HTTP server using the default Socket.IO path (`/socket.io`).

## Connection & Auth
- Protocol: `ws`/`wss` via Socket.IO.
- Origins allowed: `https://player.beatfly-music.xyz`, `https://experimental.beatfly-music.xyz`, `http://localhost:3000`.
- Authentication: JWT required. Provide the token as `auth.token` in the Socket.IO client options or as a `token` query parameter. Tokens are verified with `JWT_SECRET`; missing/invalid tokens reject the connection.
- On successful auth the server immediately emits `playback:connected` with `{ userId }`.

## Events

### Client → Server
- `playback:sync`
  - Purpose: Persist the user’s current playback position.
  - Payload: `{ trackId: number, positionSeconds: number, isPaused?: boolean }`
  - Behavior: When `trackId` and `positionSeconds` are present, the server upserts into `playback_positions` and replies with `playback:ack`. Invalid/missing data is ignored silently. Errors emit `playback:error`.
- `playback:request`
  - Purpose: Fetch the latest saved playback state for the authenticated user.
  - Payload: none
  - Response: Server emits `playback:state` (see shape below) or `null` if no state. Errors emit `playback:error`.

### Server → Client
- `playback:connected` — sent on connection; payload `{ userId: number }`.
- `playback:ack` — confirmation after a successful `playback:sync`; payload echoes the saved state `{ trackId, positionSeconds, isPaused }`.
- `playback:state` — latest stored state or `null`.
- `playback:error` — `{ message: string }` describing a failure (DB or validation).

## Playback State Shape
When available, `playback:state` payload is:
```json
{
  "userId": number,
  "trackId": number,
  "positionSeconds": number,
  "isPaused": boolean,
  "updatedAt": string   // MySQL timestamp
}
```
The data is persisted to the `playback_positions` table (`user_id` PK, `track_id`, `position_seconds`, `is_paused`, `updated_at`).

## Client Example (Socket.IO v4)
```js
import { io } from 'socket.io-client';

const socket = io('https://player.beatfly-music.xyz', {
  transports: ['websocket'],
  auth: { token: '<JWT_FROM_LOGIN>' }
});

socket.on('connect_error', (err) => console.error('socket error', err.message));
socket.on('playback:connected', ({ userId }) => console.log('connected as', userId));
socket.on('playback:ack', (state) => console.log('saved', state));
socket.on('playback:state', (state) => console.log('resume state', state));
socket.on('playback:error', (err) => console.error('playback error', err.message));

// Save progress
socket.emit('playback:sync', { trackId: 42, positionSeconds: 61, isPaused: false });

// Retrieve last known position
socket.emit('playback:request');
```
