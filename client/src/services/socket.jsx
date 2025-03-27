import { io } from 'socket.io-client';

// Determine server URL based on current environment
const getServerUrl = () => {
  // Check if we're in production (deployment) by checking the domain
  if (window.location.hostname !== 'localhost') {
    return window.location.origin; // Use the same origin for WebSocket in production
  }
  return process.env.REACT_APP_SERVER_URL || 'http://localhost:8080';
};

// Create a singleton socket instance with connection options
const socket = io(getServerUrl(), { // <-- Use the function here!
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  autoConnect: true,
  forceNew: false
});

// Debug connection events
socket.on('connect', () => {
  console.log('Socket connected with ID:', socket.id);
  console.log('Connected to server:', getServerUrl());
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
  console.log('Failed connecting to:', getServerUrl());
});

export default socket;