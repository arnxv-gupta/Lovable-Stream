const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const PORT = process.env.PORT || 5000;

// rooms[roomId] = { ownerId, videoUrl, isPlaying, time, users: [{id, name}] }
const rooms = {};

const DEFAULT_VIDEO = '';

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('join-room', (roomId, userName) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      // First joiner → owner
      rooms[roomId] = {
        ownerId: socket.id,
        videoUrl: DEFAULT_VIDEO,
        isPlaying: false,
        time: 0,
        users: [],
      };
    }

    const isOwner = rooms[roomId].ownerId === socket.id;
    const user = { id: socket.id, name: userName, isOwner };
    
    // Prevent duplicate entries if a client emits join-room multiple times
    const existingUserIndex = rooms[roomId].users.findIndex(u => u.id === socket.id);
    if (existingUserIndex !== -1) {
      rooms[roomId].users[existingUserIndex] = user;
    } else {
      rooms[roomId].users.push(user);
    }

    // Send full room state to the new joiner
    socket.emit('room-state', {
      videoUrl: rooms[roomId].videoUrl,
      isPlaying: rooms[roomId].isPlaying,
      time: rooms[roomId].time,
      users: rooms[roomId].users,
      ownerId: rooms[roomId].ownerId,
      isOwner,
    });

    // Tell everyone else someone joined
    socket.to(roomId).emit('user-joined', user);
    socket.to(roomId).emit('users-update', rooms[roomId].users);

    // WebRTC: give the new user the list of existing users to call
    const others = rooms[roomId].users.filter(u => u.id !== socket.id);
    socket.emit('all-users', others);

    // ── Disconnect ────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log('Disconnected:', socket.id);
      rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);

      // Transfer host if owner left
      if (rooms[roomId].ownerId === socket.id && rooms[roomId].users.length > 0) {
        const newOwner = rooms[roomId].users[0];
        rooms[roomId].ownerId = newOwner.id;
        rooms[roomId].users[0].isOwner = true;
        io.to(newOwner.id).emit('you-are-now-host');
        io.to(roomId).emit('host-changed', newOwner.id);
      }

      if (rooms[roomId].users.length === 0) {
        delete rooms[roomId];
      } else {
        io.to(roomId).emit('user-left', socket.id);
        io.to(roomId).emit('users-update', rooms[roomId].users);
      }
    });

    // ── Chat ──────────────────────────────────────────────
    socket.on('chat-message', (msg) => {
      io.to(roomId).emit('chat-message', {
        sender: userName,
        senderId: socket.id,
        text: msg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        id: Date.now() + Math.random(),
      });
    });

    // ── Reactions ─────────────────────────────────────────
    socket.on('send-reaction', (reaction) => {
      io.to(roomId).emit('receive-reaction', { sender: userName, reaction });
    });

    // ── Video Sync (owner only – enforced server-side) ────
    socket.on('play-video', (time) => {
      if (rooms[roomId]?.ownerId !== socket.id) return;
      rooms[roomId].isPlaying = true;
      rooms[roomId].time = time;
      socket.to(roomId).emit('play-video', time);
    });

    socket.on('pause-video', (time) => {
      if (rooms[roomId]?.ownerId !== socket.id) return;
      rooms[roomId].isPlaying = false;
      rooms[roomId].time = time;
      socket.to(roomId).emit('pause-video', time);
    });

    socket.on('seek-video', (time) => {
      if (rooms[roomId]?.ownerId !== socket.id) return;
      rooms[roomId].time = time;
      socket.to(roomId).emit('seek-video', time);
    });

    socket.on('change-video', (url) => {
      if (rooms[roomId]?.ownerId !== socket.id) return;
      rooms[roomId].videoUrl = url;
      rooms[roomId].time = 0;
      rooms[roomId].isPlaying = false;
      io.to(roomId).emit('change-video', url);
    });

    // ── Permission System ─────────────────────────────────
    // Guest requests control
    socket.on('request-control', () => {
      const ownerId = rooms[roomId]?.ownerId;
      if (!ownerId || ownerId === socket.id) return;
      io.to(ownerId).emit('control-request', { userId: socket.id, userName });
    });

    // Owner grants control
    socket.on('grant-control', (targetId) => {
      if (rooms[roomId]?.ownerId !== socket.id) return;
      io.to(targetId).emit('control-granted');
      socket.to(roomId).emit('control-granted-announce', { userId: targetId });
    });

    // Owner denies control
    socket.on('deny-control', (targetId) => {
      if (rooms[roomId]?.ownerId !== socket.id) return;
      io.to(targetId).emit('control-denied');
    });

    // Guest relinquishes control
    socket.on('release-control', () => {
      const ownerId = rooms[roomId]?.ownerId;
      if (ownerId) io.to(ownerId).emit('control-released', { userId: socket.id, userName });
    });

    // ── WebRTC Signaling ──────────────────────────────────
    socket.on('sending-signal', payload => {
      io.to(payload.userToSignal).emit('user-joined-webrtc', {
        signal: payload.signal,
        callerID: payload.callerID,
        name: userName,
      });
    });

    socket.on('returning-signal', payload => {
      io.to(payload.callerID).emit('receiving-returned-signal', {
        signal: payload.signal,
        id: socket.id,
      });
    });
  });
});

server.listen(PORT, () => console.log(`🚀 Lovable server running on port ${PORT}`));
