const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

// App and server initialization
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../client/build")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

/**
 * Game state storage
 * ==================
 * rooms - Stores all active game rooms with players and settings
 * roomHosts - Maps room IDs to host usernames
 * roomTimers - Stores timer information for each room
 * roomKickedPlayers - Tracks recently kicked players with timestamps
 */
const rooms = {};
const roomHosts = new Map();
const roomTimers = {};
const roomKickedPlayers = {};

/**
 * Helper Functions
 */
function getPlayersList(roomId) {
  return rooms[roomId]?.players.map(player => player.username) || [];
}

function getReadyPlayersList(roomId) {
  return rooms[roomId]?.readyPlayers || [];
}

function broadcastRoomUpdate(roomId) {
  const playersList = getPlayersList(roomId);
  const readyPlayersList = getReadyPlayersList(roomId);
  io.to(roomId).emit('room_players_list', playersList, readyPlayersList);
}

function isPlayerKicked(roomId, username) {
  if (roomKickedPlayers[roomId] && roomKickedPlayers[roomId][username]) {
    const kickTime = roomKickedPlayers[roomId][username];
    const timeElapsed = Date.now() - kickTime;
    
    if (timeElapsed < 10000) { // 10 seconds timeout
      return true;
    } else {
      // Kick timeout expired, remove from kick list
      delete roomKickedPlayers[roomId][username];
    }
  }
  return false;
}

function cleanupEmptyRoom(roomId) {
  if (rooms[roomId] && rooms[roomId].players.length === 0) {
    delete rooms[roomId];
    delete roomKickedPlayers[roomId];
    delete roomTimers[roomId];
    roomHosts.delete(roomId);
    console.log(`Removed empty room ${roomId} and its associated data`);
    return true;
  }
  return false;
}

/**
 * Socket.IO Connection Handler
 */
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  /**
   * Room Management
   */
  socket.on('join_room', (roomId, username, isHost) => {
    // Check if room exists and is locked
    if (rooms[roomId] && rooms[roomId].locked) {
      socket.emit('room_locked_error', roomId);
      return;
    }

    // Check if player was recently kicked
    if (isPlayerKicked(roomId, username)) {
      console.log(`Rejected join attempt: ${username} was kicked from room ${roomId}`);
      socket.emit('you_were_kicked');
      return;
    }

    // Join the socket.io room
    socket.join(roomId);

    // Create room if it doesn't exist
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

    // Create timer if it doesn't exist
    if (!roomTimers[roomId]) {
      roomTimers[roomId] = {
        startTime: Date.now(),
        duration: 60000 // 1 minute in milliseconds
      };
    }

    // Check if player already exists
    const existingPlayerIndex = rooms[roomId].players.findIndex(
      player => player.username === username
    );

    if (existingPlayerIndex !== -1) {
      // Update socket ID for existing player
      rooms[roomId].players[existingPlayerIndex].id = socket.id;
    } else {
      // Add new player
      rooms[roomId].players.push({ id: socket.id, username });
      io.to(roomId).emit('player_joined', username);
    }

    // Set host if specified
    if (isHost) {
      roomHosts.set(roomId, username);
    }

    // Send current players list and room data
    broadcastRoomUpdate(roomId);
    socket.emit('join_room_success', roomId);
  });

  socket.on('lock_room', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].locked = true;
      io.to(roomId).emit('room_locked');
    }
  });

  socket.on('unlock_room', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].locked = false;
      io.to(roomId).emit('room_unlocked');
    } 
  });

  /**
   * Player Status Events
   */
  socket.on('player_ready', (roomId, username) => {
    const room = rooms[roomId];
    if (room && !room.readyPlayers.includes(username)) {
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

  socket.on('kick_player', (roomId, playerToKick) => {
    console.log(`Kick player request received: ${playerToKick} from room ${roomId}`);
    
    const room = rooms[roomId];
    if (!room) {
      console.log(`Room ${roomId} not found for kick operation`);
      return;
    }
    
    // Find the player to kick
    const playerToKickData = room.players.find(player => player.username === playerToKick);
    if (!playerToKickData) {
      console.log(`Player ${playerToKick} not found in room ${roomId}`);
      return;
    }
    
    // Remove player from the room
    room.players = room.players.filter(player => player.username !== playerToKick);
    room.readyPlayers = room.readyPlayers.filter(player => player !== playerToKick);
    
    // Notify the kicked player
    io.to(playerToKickData.id).emit('you_were_kicked');
    
    // Force leave room
    const socketToKick = io.sockets.sockets.get(playerToKickData.id);
    if (socketToKick) {
      socketToKick.leave(roomId);
      console.log(`Socket ${playerToKickData.id} forced to leave room ${roomId}`);
    }
    
    // Add to kicked players list with timeout
    if (!roomKickedPlayers[roomId]) {
      roomKickedPlayers[roomId] = {};
    }
    roomKickedPlayers[roomId][playerToKick] = Date.now();
    
    // Notify room and update player list
    io.to(roomId).emit('player_kicked', playerToKick);
    broadcastRoomUpdate(roomId);
  });

  /**
   * Timer Events
   */
  socket.on('get_lobby_timer', (roomId) => {
    if (roomTimers[roomId]) {
      socket.emit('lobby_timer', roomTimers[roomId].startTime, roomTimers[roomId].duration);
    } else {
      const defaultStartTime = Date.now();
      const defaultDuration = 60000;
      socket.emit('lobby_timer', defaultStartTime, defaultDuration);
    }
  });

  /**
   * Game Settings
   */
  socket.on('update_settings', (roomId, newSettings) => {
    if (rooms[roomId]) {
      rooms[roomId].settings = newSettings;
      io.to(roomId).emit('settings_updated', newSettings);
    }
  });

  /**
   * Game Flow
   */
  socket.on('start_game', (roomId, gameSettings) => {
    if (rooms[roomId]) {
      // Optional: Store settings for the game
      rooms[roomId].settings = gameSettings || rooms[roomId].settings;
      io.to(roomId).emit('game_started');
    }
  });

  socket.on('join_game', (roomId, username) => {
    socket.join(roomId);
    const room = rooms[roomId];
    if (room) {
      // In a real implementation, you'd assign roles and send actual game state
      io.to(socket.id).emit('role_assigned', 'waiting');
      io.to(socket.id).emit('game_state_update', {
        phase: 'night',
        phaseTime: room.settings.nightDuration,
        players: room.players.map(player => ({ 
          username: player.username, 
          isAlive: true 
        })),
        role: 'waiting',
        isAlive: true,
      });
    }
  });

  /**
   * Connection Management
   */
  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    
    // Check all rooms for the disconnected player
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const disconnectedPlayer = room.players.find(player => player.id === socket.id);
      
      if (disconnectedPlayer) {
        // Remove player from the room
        room.players = room.players.filter(player => player.id !== socket.id);
        room.readyPlayers = room.readyPlayers.filter(
          player => player !== disconnectedPlayer.username
        );
        
        // Notify room of player departure
        io.to(roomId).emit('player_left', disconnectedPlayer.username);
        
        // Update player list
        broadcastRoomUpdate(roomId);
        
        // Clean up empty rooms
        cleanupEmptyRoom(roomId);
      }
    }
  });
});

// SPA route handler
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});