// client/src/App.js
import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Connect to your backend server; adjust the URL if needed.
const socket = io('http://localhost:4000');

function App() {
  const [response, setResponse] = useState('');

  useEffect(() => {
    // Log connection and handle incoming events
    socket.on('connect', () => {
      console.log('Connected with ID:', socket.id);
    });

    // Listen for a response from the server
    socket.on('response_event', (data) => {
      console.log('Server says:', data);
      setResponse(data.msg);
    });

    // Clean up the event listeners on unmount
    return () => {
      socket.off('connect');
      socket.off('response_event');
    };
  }, []);

  // Function to emit a test event to the server
  const sendMessage = () => {
    socket.emit('example_event', { msg: 'Hello from React!' });
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>React + Socket.IO Example</h1>
      <button onClick={sendMessage}>Send Message</button>
      {response && <p>Server Response: {response}</p>}
    </div>
  );
}

export default App;

