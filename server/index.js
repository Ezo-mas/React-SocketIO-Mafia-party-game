const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
app.use(cors()); // Allow cross-origin requests

app.use(express.static(path.join(__dirname, "../client/build")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }  // Allow connections from any origin
});

const rooms = {};

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  socket.on('join_room', (roomId, username, isHost) => {
    socket.join(roomId);
    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        readyPlayers: [],
        settings: {
          dayDuration: 120,
          nightDuration: 60,
          mafiaPercentage: 30,
          detectiveEnabled: true,
          doctorEnabled: true,
        },
        locked: false,
      };
    }

    if (isHost) {
      // You can use a Map or object to track room hosts
      rooms = rooms || new Map();
      rooms.set(roomId, username);
    }
    rooms[roomId].players.push({ id: socket.id, username });
    io.to(roomId).emit('player_joined', username);
  });

  socket.on('player_ready', (roomId, username) => {
    const room = rooms[roomId];
    if (room) {
      room.readyPlayers.push(username);
      io.to(roomId).emit('player_ready', username);
    }
  });

  socket.on('player_not_ready', (roomId, username) => {
    const room = rooms[roomId];
    if (room) {
      room.readyPlayers = room.readyPlayers.filter(player => player !== username);
      io.to(roomId).emit('player_not_ready', username);
    }
  });

  socket.on('lock_room', (roomId) => {
    const room = rooms[roomId];
    if (room) {
      room.locked = true;
      io.to(roomId).emit('room_locked');
    }
  });

  socket.on('kick_player', (roomId, playerToKick) => {
    const room = rooms[roomId];
    if (room) {
      room.players = room.players.filter(player => player.username !== playerToKick);
      room.readyPlayers = room.readyPlayers.filter(player => player !== playerToKick);
      io.to(roomId).emit('player_kicked', playerToKick);
    }
  });

  socket.on('update_settings', (roomId, newSettings) => {
    const room = rooms[roomId];
    if (room) {
      room.settings = newSettings;
      io.to(roomId).emit('settings_updated', newSettings);
    }
  });

  socket.on('start_game', (roomId) => {
    io.to(roomId).emit('game_started');
  });

  socket.on('join_game', (roomId, username) => {
    socket.join(roomId);
    const room = rooms[roomId];
    if (room) {
      io.to(socket.id).emit('role_assigned', 'waiting'); // Placeholder for role assignment logic
      io.to(socket.id).emit('game_state_update', {
        phase: 'night',
        phaseTime: room.settings.nightDuration,
        players: room.players.map(player => ({ username: player.username, isAlive: true })),
        role: 'waiting',
        isAlive: true,
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      room.players = room.players.filter(player => player.id !== socket.id);
      room.readyPlayers = room.readyPlayers.filter(player => player.id !== socket.id);
      io.to(roomId).emit('player_left', socket.id);
    }
  });
});

// For any other route, serve the index.html file from the build
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.stdin.resume();
