import { io } from 'socket.io-client';

// Create a singleton socket instance with connection options
const socket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:8080', {
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
});

socket.on('disconnect', () => {
  console.log('Socket disconnected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
});

export default socket;