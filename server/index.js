// server/index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors()); // Allow cross-origin requests

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }  // Allow connections from any origin
});

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);
  
  // Example: listen for a custom event
  socket.on('example_event', (data) => {
    console.log('Received:', data);
    // Optionally broadcast or emit a response
    io.emit('response_event', { msg: 'Hello from server!' });
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const path = require('path');
app.use(express.static(path.join(__dirname, '../client/build')));

// For any other route, serve the index.html file from the build
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});
