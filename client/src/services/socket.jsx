import { io } from 'socket.io-client';

// Determine server URL based on current environment
const getServerUrl = () => {
  // Check if we're in a test environment or if window is undefined
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
    return 'http://localhost:8080'; // Mock URL for tests
  }
  
  // Check if we're in production (deployment) by checking the domain
  if (window.location.hostname !== 'localhost') {
    return window.location.origin; // Use the same origin for WebSocket in production
  }
  return process.env.REACT_APP_SERVER_URL || 'http://localhost:8080';
};

// Create a singleton socket instance with connection options
const socket = io(getServerUrl(), {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: true
});

/**
 * Centralized storage for game-related data
 */
const GameStorage = {
  // Room management
  setActiveRoom: (roomId) => localStorage.setItem('active_game_room', roomId),
  getActiveRoom: () => localStorage.getItem('active_game_room'),
  
  // Transition state management
  setTransitioning: (roomId) => localStorage.setItem('transitioning_to_game', roomId),
  getTransitioning: () => localStorage.getItem('transitioning_to_game'),
  clearTransitioning: () => localStorage.removeItem('transitioning_to_game'),
  
  // Page refresh state
  setRefreshing: () => localStorage.setItem('page_refreshing', 'true'),
  getRefreshing: () => localStorage.getItem('page_refreshing') === 'true', // Add this line
  clearRefreshing: () => localStorage.removeItem('page_refreshing'),

  // Room creation indicator
  setCreatingRoom: (value) => localStorage.setItem('creating_new_room', value === true ? 'true' : value),
  getCreatingRoom: () => localStorage.getItem('creating_new_room'),
  clearCreatingRoom: () => localStorage.removeItem('creating_new_room'),
  
  // User data
  setUsername: (name) => localStorage.setItem('username', name),
  getUsername: () => localStorage.getItem('username'),
  
  // Game state
  setPlayerRole: (role) => localStorage.setItem('player_role', role),
  getPlayerRole: () => localStorage.getItem('player_role'),
  
  setGamePhase: (phase) => localStorage.setItem('game_phase', phase),
  getGamePhase: () => localStorage.getItem('game_phase'),

  setLastSessionTime: (time) => localStorage.setItem('last_session_time', time),
  getLastSessionTime: () => localStorage.getItem('last_session_time'),
  
  setGameSettings: (settings) => {
    localStorage.setItem('game_settings', 
      typeof settings === 'object' ? JSON.stringify(settings) : settings);
  },
  getGameSettings: () => {
    const settings = localStorage.getItem('game_settings');
    try {
      return settings ? JSON.parse(settings) : null;
    } catch (e) {
      console.error('Failed to parse game settings:', e);
      return null;
    }
  },
  
  // Clear all game data
  clearGameData: () => {
    localStorage.removeItem('active_game_room');
    localStorage.removeItem('transitioning_to_game');
    localStorage.removeItem('game_settings');
    localStorage.removeItem('player_role');
    localStorage.removeItem('game_phase');
    localStorage.removeItem('creating_new_room');
    localStorage.removeItem('page_refreshing');
  }
};

/**
 * Handle connection reestablishment
 */
socket.on('connect', () => {
  console.log('Socket connected with ID:', socket.id);
  
  // Try to reconnect to any active game
  const roomId = GameStorage.getTransitioning() || GameStorage.getActiveRoom();
  const username = GameStorage.getUsername();
  
  if (roomId && username) {
    console.log(`Attempting to reconnect to room ${roomId} as ${username}`);
    
    // Send reconnection info first
    socket.emit('reconnect_info', { roomId, username }, (response) => {
      if (response && response.error) {
        console.error('Reconnection failed:', response.error);
        GameStorage.clearGameData();
        
        // Redirect only if we're on a game or lobby page
        if (window.location.pathname.includes('/game/') || 
            window.location.pathname.includes('/lobby/')) {
          console.log('Redirecting to home after reconnection failure');
          window.location.href = '/';
        }
      } else {
        console.log('Reconnection successful');
      }
    });
  }
});

/**
 * Before page unloads, mark if we're refreshing to distinguish
 * between navigation and refresh
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const roomId = GameStorage.getActiveRoom();
    if (roomId) {
      GameStorage.setRefreshing();
      // The socket 'disconnect' event will fire automatically
    }
  });
}

/**
 * Enter a game room
 * @param {string} roomId - ID of the room to join
 * @param {string} username - Player username
 */
export const enterGame = (roomId, username) => {
  const oldRoomId = GameStorage.getActiveRoom();
  if (oldRoomId && oldRoomId !== roomId) {
    socket.emit('leave_game_room', oldRoomId);
  }
  
  GameStorage.setActiveRoom(roomId);
  GameStorage.setUsername(username);
};

/**
 * Leave a game room
 * @param {string} roomId - ID of the room to leave
 */
export const leaveGame = (roomId) => {
  GameStorage.clearTransitioning();
  GameStorage.clearCreatingRoom();
  localStorage.removeItem('active_game_room');
  socket.emit('leave_game_room', roomId);
};

/**
 * Mark user as transitioning to a game
 * @param {string} roomId - ID of the game room
 */
export const transitionToGame = (roomId) => {
  GameStorage.setTransitioning(roomId);
};

/**
 * Prepare for creating a new room
 * @param {string} roomId - ID of the room being created
 */
export const prepareRoomCreation = (roomId) => {
  GameStorage.setCreatingRoom(roomId || true);
};

/**
 * Socket event handlers for connection status
 */
socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
  console.log('Failed connecting to:', getServerUrl());
});

/**
 * Handle room not found situations
 */
socket.on('room_not_found', (data) => {
  console.log('Room no longer exists:', data.message);
  
  // Clear all stored room data
  GameStorage.clearGameData();
  
  // Redirect to home page if on a game page
  if (window.location.pathname.includes('/game/') || 
      window.location.pathname.includes('/lobby/')) {
    console.log('Redirecting to home page because room no longer exists');
    window.location.href = '/';
  }
});

export { GameStorage };
export default socket;