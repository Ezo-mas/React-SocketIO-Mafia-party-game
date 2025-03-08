// server/index.js
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


io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  
  socket.on('join_room', (roomId, username) => {
    socket.join(roomId);
    io.to(roomId).emit('player_joined', username);
  });

  socket.on('start_game', (roomId) => {
    io.to(roomId).emit('game_started');
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
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
