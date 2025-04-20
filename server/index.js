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
const emptyGameRooms = {};
const timeouts = new Map();

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

function setManagedTimeout(id, callback, delay) {
  clearManagedTimeout(id); // Clear any existing timeout with this ID
  
  timeouts.set(id, setTimeout(() => {
    callback();
    timeouts.delete(id); // Auto-cleanup when complete
  }, delay));
  
  return id;
}

function clearManagedTimeout(id) {
  if (timeouts.has(id)) {
    clearTimeout(timeouts.get(id));
    timeouts.delete(id);
    return true;
  }
  return false;
}

function startPhaseTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  
  // Clear any existing timer
  clearManagedTimeout(`phase_${roomId}`);
  
  // Get the current phase and duration
  const currentPhase = room.gameState?.phase || 'night';
  const phaseDuration = currentPhase === 'day' ? 
    room.settings.dayDuration : 
    room.settings.nightDuration;
    
  let remainingTime = phaseDuration;
  
  // Send initial phase time to all clients
  io.to(roomId).emit('phase_timer_update', {
    phase: currentPhase,
    remainingTime: remainingTime
  });
  
  // Set up the countdown interval using our managed interval system
  const intervalId = setInterval(() => {
    remainingTime--;
    
    // Broadcast remaining time to all clients
    io.to(roomId).emit('phase_timer_update', {
      phase: currentPhase,
      remainingTime: remainingTime
    });
    
    // When timer reaches zero, switch to the next phase
    if (remainingTime <= 0) {
      clearInterval(intervalId);
      
      // Toggle phase
      const nextPhase = currentPhase === 'day' ? 'night' : 'day';
      
      // Update the game state
      room.gameState = {
        ...room.gameState,
        phase: nextPhase,
        transitioning: true
      };
      
      // Send phase transition event to clients
      io.to(roomId).emit('phase_change', {
        phase: nextPhase
      });
      
      // Start the next phase timer after a delay using managed timeout
      setManagedTimeout(`phase_transition_${roomId}`, () => {
        startPhaseTimer(roomId);
      }, 5000);
    }
  }, 1000);
  
  // Store the interval ID for cleanup
  room.phaseTimer = intervalId;
}


function updatePlayerStatus(roomId, socketId, username, status, data = {}) {
  const room = rooms[roomId];
  if (!room) return false;
  
  // Find the player
  let playerIndex = -1;
  
  // First try to find by socketId if provided
  if (socketId) {
    playerIndex = room.players.findIndex(p => p.id === socketId);
  }
  
  // If not found and username provided, try to find by username
  if (playerIndex === -1 && username) {
    playerIndex = room.players.findIndex(p => p.username === username);
  }
  
  // Player not found
  if (playerIndex === -1) return false;
  
  const player = room.players[playerIndex];
  const now = Date.now();
  
  switch (status) {
    case 'connected':
      // Update socket ID if provided and different
      if (socketId && player.id !== socketId) {
        player.id = socketId;
      }
      
      // Clear any disconnected status
      if (player.disconnected) {
        delete player.disconnected;
        delete player.disconnectTime;
        io.to(roomId).emit('player_reconnected', player.username);
      }
      
      return player;
      
    case 'disconnected':
      player.disconnected = true;
      player.disconnectTime = now;
      io.to(roomId).emit('player_disconnected', player.username);
      return player;
      
    case 'kicked':
      // Remove from players list
      room.players.splice(playerIndex, 1);
      room.readyPlayers = room.readyPlayers.filter(p => p !== player.username);
      
      // Add to kicked list
      if (!roomKickedPlayers[roomId]) {
        roomKickedPlayers[roomId] = {};
      }
      roomKickedPlayers[roomId][player.username] = now;
      
      // Notify socket of being kicked if socket ID provided
      if (socketId) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('you_were_kicked');
          socket.leave(roomId);
        }
      }
      
      io.to(roomId).emit('player_kicked', player.username);
      return { username: player.username, action: 'kicked' };
      
    case 'transition':
      // Mark as transitioning to another page
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.data.transitioningToGame = data.destination;
      }
      return player;
      
    default:
      return false;
  }
};

/**
 * Broadcast room player updates with rate limiting
 */
/**
 * Unified broadcast function for room updates
 * @param {string} roomId - The room ID to broadcast to
 * @param {string} type - The type of update ('players', 'timer', 'settings')
 * @param {boolean} force - Whether to bypass rate limiting
 */
function broadcastRoomUpdate(roomId, type = 'players', force = false) {
  if (!rooms[roomId]) return false;

  const playerCount = rooms[roomId]?.players?.length || 1;
  const adaptiveMinDelay = Math.max(2000, 1000 * Math.min(playerCount, 8)); // Increase delay with more players
  
  const now = Date.now();
  const minDelay = force ? 500 : adaptiveMinDelay;
  
  // Initialize tracking if not present
  if (!lastBroadcastTime[roomId]) {
    lastBroadcastTime[roomId] = {};
  }
  
  // Check if rate-limited
  if (!force && 
      lastBroadcastTime[roomId][type] && 
      (now - lastBroadcastTime[roomId][type]) < minDelay) {
    return false;
  }
  
  switch (type) {
    case 'players':
      const playersList = getPlayersList(roomId);
      const readyPlayersList = getReadyPlayersList(roomId);
      
      io.to(roomId).emit('room_players_list', playersList, readyPlayersList);
      lastBroadcastTime[roomId][type] = now;
      break;
      
    case 'timer':
      if (roomTimers[roomId]) {
        io.to(roomId).emit(
          'lobby_timer', 
          roomTimers[roomId].startTime, 
          roomTimers[roomId].duration
        );
        lastBroadcastTime[roomId][type] = now;
      }
      break;
      
    case 'settings':
      if (rooms[roomId].settings) {
        io.to(roomId).emit('settings_updated', rooms[roomId].settings);
        lastBroadcastTime[roomId][type] = now;
      }
      break;
  }
  
  return true;
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
function cleanupRooms(specificRoomId = null, force = false) {
  console.log(specificRoomId ? 
    `Checking room ${specificRoomId} for cleanup` : 
    "Running room cleanup check");
  
  const now = Date.now();
  let cleanedCount = 0;
  
  // Check specific room or all rooms
  const roomsToCheck = specificRoomId ? 
    (rooms[specificRoomId] ? [specificRoomId] : []) : 
    Object.keys(rooms);
  
  for (const roomId of roomsToCheck) {
    const room = rooms[roomId];
    
    // Case 1: Empty room
    if (!room.players || room.players.length === 0) {
      if (!force) {
        const roomAge = now - (room.lastActivity || now);
        if (roomAge < 30000) {
          console.log(`Room ${roomId} is empty but was recently active - delaying cleanup`);
          continue;
        }
      }
      
      // Clean up the room and associated data
      delete rooms[roomId];
      delete roomKickedPlayers[roomId];
      delete roomTimers[roomId];
      delete emptyGameRooms[roomId];
      roomHosts.delete(roomId);
      
      cleanedCount++;
      console.log(`Cleaned up empty room ${roomId}`);
      continue;
    }
    
    // Case 2: Room with all disconnected players
    const allDisconnected = room.players.every(player => player.disconnected);
    
    if (allDisconnected) {
      const lastDisconnectTime = Math.max(
        ...room.players
          .filter(p => p.disconnectTime)
          .map(p => p.disconnectTime)
      );
      
      if (force || now - lastDisconnectTime > 2 * 60 * 1000) {
        delete rooms[roomId];
        delete roomKickedPlayers[roomId];
        delete roomTimers[roomId];
        delete emptyGameRooms[roomId];
        roomHosts.delete(roomId);
        
        cleanedCount++;
        console.log(`Cleaned up room ${roomId} with all players disconnected`);
      }
    }
    
    // Case 3: Room with active game but no players
    if (room.gameState && room.players.length === 0) {
      if (!emptyGameRooms[roomId]) {
        emptyGameRooms[roomId] = now;
        console.log(`Room ${roomId} has active game but no players - marked for delayed cleanup`);
      } else if (force || now - emptyGameRooms[roomId] > 5 * 60 * 1000) {
        delete rooms[roomId];
        delete roomKickedPlayers[roomId];
        delete roomTimers[roomId];
        roomHosts.delete(roomId);
        delete emptyGameRooms[roomId];
        
        cleanedCount++;
        console.log(`Cleaned up abandoned game room ${roomId}`);
      }
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} rooms`);
  }
  
  return cleanedCount;
}

setInterval(() => cleanupRooms(), 60 * 1000);

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
  let jesterCount = room.settings.jesterEnabled ? 1 : 0;

  // Ensure the total number of roles does not exceed the number of players
  if (mafiaCount + detectiveCount + doctorCount + jesterCount > playerCount) {
    // Adjust roles dynamically if there are too few players
    if (mafiaCount > 0) mafiaCount--;
    if (detectiveCount > 0 && mafiaCount + detectiveCount + doctorCount > playerCount) detectiveCount--;
    if (doctorCount > 0 && mafiaCount + detectiveCount + doctorCount > playerCount) doctorCount--;
    if (jesterCount > 0 && mafiaCount + detectiveCount + doctorCount + jesterCount > playerCount) jesterCount--;
  }

  // Calculate the remaining civilians
  const civilianCount = playerCount - mafiaCount - detectiveCount - doctorCount - jesterCount;

  // Create a list of roles
  const roles = [
    ...Array(mafiaCount).fill('Mafia'),
    ...Array(detectiveCount).fill('Detective'),
    ...Array(doctorCount).fill('Doctor'),
    ...Array(civilianCount).fill('Civilian'),
    ...Array(jesterCount).fill('Jester'),
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

  socket.on('reconnect_info', ({roomId, username}) => {

    if (!rooms[roomId]) {
      console.log(`Room ${roomId} no longer exists - likely due to server restart`);
      socket.emit('room_not_found', {message: 'This room no longer exists'});
      return;
    }
    socket.data.isReconnection = true;
    socket.join(roomId);
    
    // Send the player back to the game
    const room = rooms[roomId];
    if (room) {
      // Find player by username
      const existingPlayerIndex = room.players.findIndex(p => p.username === username);
      let player;
      
      if (existingPlayerIndex === -1) {
        console.log(`Player ${username} not found in room ${roomId}, adding as new player`);
        player = { id: socket.id, username, role: 'waiting' };
        room.players.push(player);
      } else {
        player = room.players[existingPlayerIndex];
        player.id = socket.id;
        delete player.disconnected;
        delete player.disconnectTime;
        console.log(`Player ${username} reconnected to room ${roomId}`);
      }
      
      // Send current game state immediately
      if (room.gameState) {
        socket.emit('role_assigned', { role: player.role });
        socket.emit('game_state_update', {
          phase: room.gameState.phase,
          phaseTime: room.gameState.phaseTime || room.settings.nightDuration,
          players: room.players.map(p => ({ username: p.username, isAlive: true })),
          role: player.role || 'waiting',
          isAlive: true
        });
      }
    }
  });

  socket.on('admin_force_cleanup', () => {
    const cleanedCount = cleanupRooms(null, true);
    socket.emit('admin_cleanup_result', {
      cleanedCount,
      remainingRooms: Object.keys(rooms).length
    });
  });
  // ---------- ROOM MANAGEMENT -----------

  /**
   * Handle player joining a room
   */
  socket.on('join_room', (roomId, username, isHost) => {

    if (rooms[roomId]) {
      // For existing rooms, mark as recently active to prevent quick cleanup
      rooms[roomId].lastActivity = Date.now();
    }
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
        gameState: null,
        phaseTimer: null,
        createdAt: Date.now(),  
        lastActivity: Date.now()
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
      broadcastRoomUpdate(roomId, 'players', true);
      
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

  socket.on('navigation_intent', (roomId) => {
    // Store navigation intent in socket data with longer timeout
    socket.data.navigatingTo = roomId;
    console.log(`Player ${socket.id} has navigation intent to room ${roomId}`);
    
    // Update lastActivity to prevent room cleanup during navigation
    if (rooms[roomId]) {
        rooms[roomId].lastActivity = Date.now();
        console.log(`Updated last activity for room ${roomId} due to navigation intent`);
    }
    
    // Clear navigation intent after 5 seconds (increased from 3)
    setTimeout(() => {
        if (socket.data.navigatingTo === roomId) {
            delete socket.data.navigatingTo;
            console.log(`Cleared navigation intent for player ${socket.id} to room ${roomId}`);
        }
    }, 5000);
});

  /**
   * Handle room locking (prevent new players from joining)
   */
  socket.on('lock_room', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].locked = true;
      io.to(roomId).emit('room_locked');
      broadcastRoomUpdate(roomId, 'players', true);
    }
  });

  /**
   * Handle room unlocking (allow new players to join)
   */
  socket.on('unlock_room', (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].locked = false;
      io.to(roomId).emit('room_unlocked');
      broadcastRoomUpdate(roomId, 'players', true);
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
      broadcastRoomUpdate(roomId, 'players', true);
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
      broadcastRoomUpdate(roomId, 'players', true);
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
    updatePlayerStatus(roomId, socket.id, null, 'disconnected');
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
    broadcastRoomUpdate(roomId, 'players', true);
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

  // In the start_game handler

socket.on('start_game', (roomId, gameSettings, devMode) => {
  const room = rooms[roomId];
  if (!room) {
    socket.emit('error', 'Room does not exist.');
    return;
  }

  // Prevent multiple game starts
  if (room.gameStarting || room.gameState) {
    console.log(`Ignoring duplicate game start request for room ${roomId}`);
    return;
  }

  if (!devMode) {
    // Check if the number of players is within the allowed range
    const playerCount = room.players.length;
    if (playerCount < 4 || playerCount > 12) {
      socket.emit('game_start_error', 'The number of players must be between 4 and 12 to start the game.');
      return;
    }
  }
  
  // Set gameStarting flag and store when it began
  room.gameStarting = true;
  room.gameStartTime = Date.now();

  // Store settings for the game
  room.settings = gameSettings || room.settings;

  const initialState = {
    transitioning: true,
    phase: 'night',
    phaseTime: room.settings.nightDuration,
    players: room.players.map(player => ({
      username: player.username,
      isAlive: true
    })),
    settings: room.settings
  };

  // Mark all players as transitioning
  room.players.forEach(player => {
    const playerSocket = io.sockets.sockets.get(player.id);
    if (playerSocket) {
      playerSocket.data.transitioningToGame = roomId;
    }
  });

  // // Assign roles to players
  // const playersWithRoles = assignRolesToPlayers(roomId); //need to move this around to fix sync issues with decision making phase

  // Send initial game state to all clients
  console.log(`Emitting game_started event for room ${roomId} with state:`, initialState);
  io.to(roomId).emit('game_started', initialState);


  //THIS FIXES MAFIA VOTE SCREEN BUT IS VERY SPAGHETTI :(
  //testing early initialization of game state
  if (!rooms[roomId].gameState) {
    rooms[roomId].gameState = initialState;
  }
  
  // Set a clear end for the gameStarting state - exactly 10 seconds
  setManagedTimeout(`game_starting_${roomId}`, () => {
    if (rooms[roomId]) {
      console.log(`Game in room ${roomId} has fully started, clearing gameStarting flag`);
      rooms[roomId].gameStarting = false;
      
      // Initialize the proper game state if not done already
      if (!rooms[roomId].gameState) {
        rooms[roomId].gameState = initialState;
      }
    }
  }, 10000);

  // Start the game countdown after a short delay
  setManagedTimeout(`game_countdown_${roomId}`, () => {
    // Start the countdown before role assignment
    const countdownDuration = 5; // 5 seconds
    io.to(roomId).emit('start_countdown', countdownDuration);
    
    let remainingTime = countdownDuration;
    io.to(roomId).emit('countdown_update', remainingTime);
    
    const countdownInterval = setInterval(() => {
      remainingTime--;
      io.to(roomId).emit('countdown_update', remainingTime);
      
      if (remainingTime <= 0) {
        clearInterval(countdownInterval);
        
        // Assign roles to players
        const playersWithRoles = assignRolesToPlayers(roomId);
        
        // Send each player their role individually
        playersWithRoles.forEach((player) => {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            playerSocket.emit('assign_role', { role: player.role });
          }
        });
        
        // Wait for role reveal animation to complete, then start the first phase
        setManagedTimeout(`start_phase_${roomId}`, () => {
          startPhaseTimer(roomId);
        }, 3000);
      }
    }, 1000);
  }, 1000);
});

// Store votes for each room
const mafiaVotes = {};

// Handle Mafia voting
socket.on('mafia_vote', ({ roomId, targetUsername }) => {
  const room = rooms[roomId];
  if (!room) return;

  const player = room.players.find(p => p.id === socket.id);
  if (!player || player.role !== 'Mafia') return; // Only Mafia can vote

  if (!mafiaVotes[roomId]) {
    mafiaVotes[roomId] = {};
  }

  mafiaVotes[roomId][socket.id] = targetUsername; // Store the vote

  console.log(`Mafia vote: ${player.username} voted for ${targetUsername}`);
});

// Process votes at the end of the night phase
function processMafiaVotes(roomId) {
  const room = rooms[roomId];
  if (!room || !mafiaVotes[roomId]) return;

  const voteCounts = {};
  Object.values(mafiaVotes[roomId]).forEach((vote) => {
    voteCounts[vote] = (voteCounts[vote] || 0) + 1;
  });

  // Determine the player with the most votes
  const targetUsername = Object.keys(voteCounts).reduce((a, b) =>
    voteCounts[a] > voteCounts[b] ? a : b
  );

  // Mark the target as dead
  const targetPlayer = room.players.find(p => p.username === targetUsername);
  if (targetPlayer) {
    targetPlayer.isAlive = false;
    console.log(`Mafia killed ${targetUsername}`);
  }

  // Clear votes for the next night
  delete mafiaVotes[roomId];

  return targetUsername; // Return the killed player
}

// Transition to the day phase
function startDayPhase(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  const killedPlayer = processMafiaVotes(roomId);

  // Notify all players about the killed player
  io.to(roomId).emit('day_phase_start', {
    killedPlayer: killedPlayer || null,
    players: room.players.map(p => ({
      username: p.username,
      isAlive: p.isAlive,
    })),
  });

  // Update the game state
  room.gameState.phase = 'day';
  room.gameState.transitioning = false;
}

  /**
   * Handle player joining a game in progress
   */
  socket.on('join_game', (roomId, username) => {

    const room = rooms[roomId];
    socket.join(roomId);
    console.log(`Player ${username} (socket ${socket.id}) joining game ${roomId}`);

    if (!room) {
      console.log(`Room ${roomId} does not exist`);
      return;
    }
    
    // Find the player by username instead of socket ID for reconnections
    const existingPlayerIndex = room.players.findIndex(p => p.username === username);
    let existingPlayer;
    
    if (existingPlayerIndex === -1) {
      // New player joining
      existingPlayer = { id: socket.id, username, role: 'waiting' };
      room.players.push(existingPlayer);
    } else {
      // Reconnecting player
      existingPlayer = room.players[existingPlayerIndex];
      existingPlayer.id = socket.id;
      
      // Clear disconnected status if reconnecting
      if (existingPlayer.disconnected) {
        delete existingPlayer.disconnected;
        delete existingPlayer.disconnectTime;
        io.to(roomId).emit('player_reconnected', username);
      }
    }

    const currentRole = existingPlayer.role || 'waiting';
    
    io.to(socket.id).emit('role_assigned', currentRole);
    
    // Check if game state exists before accessing its properties
    if (room.gameState) {
      io.to(socket.id).emit('game_state_update', {
        phase: room.gameState.phase,
        phaseTime: room.gameState.phaseTime || room.settings.nightDuration,
        players: room.players.map(player => ({ 
          username: player.username, 
          isAlive: true 
        })),
        role: currentRole,
        isAlive: true,
      });
    } else {
      // Handle case when game hasn't started yet
      io.to(socket.id).emit('game_state_update', {
        phase: 'waiting',
        phaseTime: 0,
        players: room.players.map(player => ({ 
          username: player.username, 
          isAlive: true 
        })),
        role: currentRole,
        isAlive: true,
      });
    }
  });

  socket.on('transition_to_game', (roomId) => {
    // Mark this socket as transitioning to game in server-side memory
    socket.data.transitioningToGame = roomId;
    console.log(`Player ${socket.id} transitioning to game ${roomId}`);
  });
  
  socket.on('leave_game_room', (roomId) => {
    if (!rooms[roomId]) {
      console.log(`Ignoring leave request for non-existent room ${roomId}`);
      return;
    }
  
    console.log(`Processing leave_game_room for ${socket.id} from room ${roomId}`);
  
    // Centralized check for whether to ignore leave request
    const shouldIgnoreLeave = () => {
      // Check for navigation intent
      if (socket.data.navigatingTo) {
        console.log(`Ignoring leave - player ${socket.id} is navigating to ${socket.data.navigatingTo}`);
        return true;
      }
  
      // Check if this is the room being created 
      const creatingRoomId = socket.handshake.query.creating_room_id;
      if (creatingRoomId === roomId) {
        console.log(`Player ${socket.id} is creating this room - not removing`);
        return true;
      }
  
      // Check for page transitions during game
      const isGameInProgress = rooms[roomId]?.gameState !== null || rooms[roomId]?.gameStarting;
      const isPageTransition = socket.data.transitioningToGame === roomId || 
                              roomId === socket.handshake.query.transitioning;
      
      if (isGameInProgress && isPageTransition) {
        console.log(`Player ${socket.id} is just changing pages during game - not removing`);
        return true;
      }
  
      return false;
    };
  
    // If any ignore conditions are met, don't process the leave
    if (shouldIgnoreLeave()) {
      return;
    }
  
    console.log(`Player ${socket.id} explicitly leaving game room ${roomId}`);
    
    // Leave the Socket.IO room
    socket.leave(roomId);
    
    const room = rooms[roomId];
    if (room) {
      // Find player in this room
      const playerIndex = room.players.findIndex(player => player.id === socket.id);
      if (playerIndex === -1) {
        console.log(`Socket ${socket.id} not found in room's player list - skipping removal`);
        return;
      }
  
      const playerUsername = room.players[playerIndex].username;
  
      // Remove player data
      room.players.splice(playerIndex, 1);
      room.readyPlayers = room.readyPlayers.filter(player => player !== playerUsername);
      
      // Notify other players
      io.to(roomId).emit('player_left', playerUsername);
      broadcastRoomUpdate(roomId, 'players', true);
      
      // Check if room should be cleaned up
      cleanupRooms(roomId);
    }
  });

  socket.on('leave_any_previous_games', () => {
  // Find all rooms this socket is in and leave them
  for (const roomId in rooms) {
    if (rooms[roomId].players.some(p => p.id === socket.id)) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(player => player.id === socket.id);
      
      if (playerIndex !== -1) {
        const playerUsername = room.players[playerIndex].username;
        
        // Don't remove players from active games, just mark as disconnected
        if (room.gameState || room.gameStarting) {
          room.players[playerIndex].disconnected = true;
          room.players[playerIndex].disconnectTime = Date.now();
          socket.leave(roomId);
          io.to(roomId).emit('player_disconnected', playerUsername);
        } else {
          // Remove from players and ready players arrays
          room.players.splice(playerIndex, 1);
          room.readyPlayers = room.readyPlayers.filter(player => player !== playerUsername);
          socket.leave(roomId);
          io.to(roomId).emit('player_left', playerUsername);
        }
        
        broadcastRoomUpdate(roomId, 'players', true);
      }
      
      // Clean up the room if it's now empty
      cleanupRooms(roomId);
    }
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
        // IMPORTANT: Check if there's a gameState OR if a game is about to start
        if (room.gameState || room.gameStarting) {
          console.log(`Player ${socket.id} disconnected from active game ${roomId} - marking as disconnected but keeping in room`);
          disconnectedPlayer.disconnected = true;
          disconnectedPlayer.disconnectTime = Date.now();
          
          // Notify room of temporary disconnect
          io.to(roomId).emit('player_disconnected', disconnectedPlayer.username);
          broadcastRoomUpdate(roomId, 'players', true);
          continue; // Skip to next room without removing player
        }
        
        // Only remove player if not in active game
        console.log(`Removing disconnected player ${socket.id} from room ${roomId} (no active game)`);
        updatePlayerStatus(roomId, socket.id, null, 'disconnected');
      }
    }
  });

  /**
   * Handle chat messages
   */
  socket.on('chat_message', (data) => {
    io.to(data.roomId).emit('receive_message', data);
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
