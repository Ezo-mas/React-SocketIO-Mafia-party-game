const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

// ==============================
// App and Server Initialization
// ==============================
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "../client/build")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// ==============================
// Game State Management
// ==============================
/**
 * Game state storage:
 * - rooms: Stores all active game rooms with players and settings
 * - roomHosts: Maps room IDs to host usernames
 * - roomTimers: Stores timer information for each room
 * - roomKickedPlayers: Tracks recently kicked players with timestamps
 * - lastBroadcastTime: Tracks when last notified all players in lobby
 */
const rooms = {};
const roomHosts = new Map();
const roomTimers = {};
const roomKickedPlayers = {};
const lastBroadcastTime = {};

// ==============================
// Helper Functions
// ==============================

/**
 * Get list of player usernames in a room
 */
function getPlayersList(roomId) {
  return rooms[roomId]?.players.map(player => player.username) || [];
}

/**
 * Get list of ready players in a room
 */
function getReadyPlayersList(roomId) {
  return rooms[roomId]?.readyPlayers || [];
}

/**
 * Broadcast timer information to all players in a room
 * with rate limiting to prevent excessive updates
 */
function broadcastTimer(roomId) {
  if (roomTimers[roomId]) {
    const now = Date.now();
    if (!roomTimers[roomId].lastBroadcast || (now - roomTimers[roomId].lastBroadcast) > 2000) {
      io.to(roomId).emit('lobby_timer', roomTimers[roomId].startTime, roomTimers[roomId].duration);
      roomTimers[roomId].lastBroadcast = now;
    }
  }
}

/**
 * Broadcast room player updates with rate limiting
 */
function broadcastRoomUpdate(roomId) {
  const now = Date.now();
  
  if (!lastBroadcastTime[roomId] || (now - lastBroadcastTime[roomId]) > 2000) {
    const playersList = getPlayersList(roomId);
    const readyPlayersList = getReadyPlayersList(roomId);
    
    io.to(roomId).emit('room_players_list', playersList, readyPlayersList);
    lastBroadcastTime[roomId] = now;
  }
}

/**
 * Force broadcast room updates even if rate limited recently
 */
function forceBroadcastRoomUpdate(roomId) {
  const now = Date.now();
  
  if (!lastBroadcastTime[roomId] || (now - lastBroadcastTime[roomId]) > 500) {
    const playersList = getPlayersList(roomId);
    const readyPlayersList = getReadyPlayersList(roomId);
    
    io.to(roomId).emit('room_players_list', playersList, readyPlayersList);
    lastBroadcastTime[roomId] = now;
  }
}

/**
 * Check if a player was kicked recently and is still banned
 */
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

/**
 * Remove empty rooms and associated data
 */
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
 * Assign random roles to players in a room
 * @param {string} roomId - The ID of the room
 * @returns {Array} - List of players with their assigned roles
 */
function assignRolesToPlayers(roomId) {
  const room = rooms[roomId];
  if (!room) return [];

  const players = [...room.players]; // Copy the players array
  const playerCount = players.length;

  // Calculate the number of each role
  let mafiaCount = Math.floor((room.settings.mafiaPercentage / 100) * playerCount);
  let detectiveCount = room.settings.detectiveEnabled ? 1 : 0;
  let doctorCount = room.settings.doctorEnabled ? 1 : 0;

  // Ensure the total number of roles does not exceed the number of players
  if (mafiaCount + detectiveCount + doctorCount > playerCount) {
    // Adjust roles dynamically if there are too few players
    if (mafiaCount > 0) mafiaCount--;
    if (detectiveCount > 0 && mafiaCount + detectiveCount + doctorCount > playerCount) detectiveCount--;
    if (doctorCount > 0 && mafiaCount + detectiveCount + doctorCount > playerCount) doctorCount--;
  }

  // Calculate the remaining civilians
  const civilianCount = playerCount - mafiaCount - detectiveCount - doctorCount;

  // Create a list of roles
  const roles = [
    ...Array(mafiaCount).fill('Mafia'),
    ...Array(detectiveCount).fill('Detective'),
    ...Array(doctorCount).fill('Doctor'),
    ...Array(civilianCount).fill('Civilian'),
  ];

  // Shuffle the roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  // Assign roles to players
  players.forEach((player, index) => {
    player.role = roles[index];
  });

  return players;
}

// ==============================
// Global Timer Updates
// ==============================
setInterval(() => {
  for (const roomId in rooms) {
    if (rooms[roomId] && rooms[roomId].players.length > 0) {
      broadcastTimer(roomId);
    }
  }
}, 5000); 

// ==============================
// Socket.IO Connection Handler
// ==============================
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // ---------- ROOM MANAGEMENT -----------

  /**
   * Handle player joining a room
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

    // Send data to client with a small delay to ensure client-side setup
    setTimeout(() => {
      // Send the player list to all clients
      forceBroadcastRoomUpdate(roomId);
      
      // Send timer info directly to this socket
      if (roomTimers[roomId]) {
        socket.emit('lobby_timer', roomTimers[roomId].startTime, roomTimers[roomId].duration);
      } else {
        const defaultStartTime = Date.now();
        const defaultDuration = 60000;
        roomTimers[roomId] = {
          startTime: defaultStartTime,
          duration: defaultDuration,
          lastSent: Date.now()
        };
        socket.emit('lobby_timer', defaultStartTime, defaultDuration);
      }
      
      // Send player list directly to the joining player
      socket.emit('room_players_list', getPlayersList(roomId), getReadyPlayersList(roomId));
      
      // Send join success last
      socket.emit('join_room_success', roomId);
    }, 200);
  });

  /**
   * Handle request for room player list
   */
  socket.on('get_room_players', (roomId) => {
    if (rooms[roomId]) {
      socket.emit('room_players_list', getPlayersList(roomId), getReadyPlayersList(roomId));
    }
  });

  /**
   * Handle room locking (prevent new players from joining)
   */
  socket.on('lock_room', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].locked = true;
      io.to(roomId).emit('room_locked');
      forceBroadcastRoomUpdate(roomId);
    }
  });

  /**
   * Handle room unlocking (allow new players to join)
   */
  socket.on('unlock_room', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].locked = false;
      io.to(roomId).emit('room_unlocked');
      forceBroadcastRoomUpdate(roomId);
    } 
  });

  // ---------- PLAYER STATUS -----------

  /**
   * Handle player ready state
   */
  socket.on('player_ready', (roomId, username) => {
    const room = rooms[roomId];
    if (room && !room.readyPlayers.includes(username)) {
      room.readyPlayers.push(username);
      io.to(roomId).emit('player_ready', username);
      forceBroadcastRoomUpdate(roomId);
    }
  });

  /**
   * Handle player not ready state
   */
  socket.on('player_not_ready', (roomId, username) => {
    const room = rooms[roomId];
    if (room) {
      room.readyPlayers = room.readyPlayers.filter(player => player !== username);
      io.to(roomId).emit('player_not_ready', username);
      forceBroadcastRoomUpdate(roomId);
    }
  });

  /**
   * Handle kicking a player from room
   */
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
    forceBroadcastRoomUpdate(roomId);
  });

  // ---------- TIMER MANAGEMENT -----------

  /**
   * Handle request for lobby timer information
   */
  socket.on('get_lobby_timer', (roomId) => {
    const now = Date.now();
    
    // Rate limiting to prevent excessive updates
    if (!roomTimers[roomId] || !roomTimers[roomId].lastSent || 
        (now - roomTimers[roomId].lastSent > 1000)) {
      
      if (roomTimers[roomId]) {
        socket.emit('lobby_timer', roomTimers[roomId].startTime, roomTimers[roomId].duration);
        roomTimers[roomId].lastSent = now;
      } else {
        const defaultStartTime = Date.now();
        const defaultDuration = 60000;
        socket.emit('lobby_timer', defaultStartTime, defaultDuration);
        
        roomTimers[roomId] = {
          startTime: defaultStartTime,
          duration: defaultDuration,
          lastSent: now
        };
      }
    }
  });

  // ---------- GAME SETTINGS -----------

  /**
   * Handle game settings updates
   */
  socket.on('update_settings', (roomId, newSettings) => {
    if (rooms[roomId]) {
      rooms[roomId].settings = newSettings;
      io.to(roomId).emit('settings_updated', newSettings);
      broadcastRoomUpdate(roomId);
    }
  });

  // ---------- GAME FLOW -----------

  //Game start

  socket.on('start_game', (roomId, gameSettings) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit('error', 'Room does not exist.');
      return;
    }
  
    /*
    // Check if the number of players is within the allowed range
    const playerCount = room.players.length;
    if (playerCount < 4 || playerCount > 12) {
      socket.emit('game_start_error', 'The number of players must be between 4 and 12 to start the game.');
      return;
    }
  */

    // Store settings for the game
    rooms[roomId].settings = gameSettings || rooms[roomId].settings;

    const initialState = {
      transitioning: true,
      phase: 'night',
      phaseTime: room.settings.nightDuration,
      players: room.players.map(player => ({
        username: player.username,
        isAlive: true
      })),
    };

    io.to(roomId).emit('game_started', initialState);
  
  
      // Broadcast the current countdown value to all clients in the room
      setTimeout(() => {
        // NOW start the countdown
        const countdownDuration = 5; // 5 seconds
        io.to(roomId).emit('start_countdown', countdownDuration);
        
        let remainingTime = countdownDuration;
        io.to(roomId).emit('countdown_update', remainingTime);
        
        const countdownInterval = setInterval(() => {
          remainingTime--;
          io.to(roomId).emit('countdown_update', remainingTime);
          
          if (remainingTime <= 0) {
            clearInterval(countdownInterval);
            
            // Continue with role assignment and game flow...
            const playersWithRoles = assignRolesToPlayers(roomId);
      
        // Send each player their role individually
        playersWithRoles.forEach((player) => {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            playerSocket.emit('assign_role', { role: player.role });
          }
        });
      }
    }, 1000);
  }, 1000);
 }); // Short delay to ensure everyone is on the GamePag

  /**
   * Handle player joining a game in progress
   */
  socket.on('join_game', (roomId, username) => {
    socket.join(roomId);
    const room = rooms[roomId];
    if (room) {
      // Send initial game state to player
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

  // ---------- CONNECTION MANAGEMENT -----------

  /**
   * Handle player disconnection
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
        forceBroadcastRoomUpdate(roomId);
        
        // Clean up empty rooms
        cleanupEmptyRoom(roomId);
      }
    }
  });
});

// ==============================
// SPA Route Handler
// ==============================
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/build/index.html"));
});

// ==============================
// Start Server
// ==============================
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});