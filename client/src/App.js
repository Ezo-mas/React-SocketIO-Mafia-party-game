// client/src/App.js
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import TitlePage from './components/TitlePage';
import LobbyPage from './components/LobbyPage';

// Connect to your backend server
const socket = io('http://localhost:4000');

function App() {
  const [response, setResponse] = useState('');

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected with ID:', socket.id);
    });

    socket.on('response_event', (data) => {
      console.log('Server says:', data);
      setResponse(data.msg);
    });

    // Clean up on unmount
    return () => {
      socket.off('connect');
      socket.off('response_event');
    };
  }, []);

  const sendMessage = () => {
    socket.emit('example_event', { msg: 'Hello from React!' });
  };

  return (
    <Router>
      <div>
        {/* Define your routes */}
        <Routes>
          <Route path="/" element={<TitlePage />} />
          <Route path="/lobby" element={<LobbyPage />} />
        </Routes>

        {/* Optionally include socket example UI or pass socket via context to your pages */}
        <div style={{ padding: '2rem', borderTop: '1px solid #ccc' }}>
          <h1>React + Socket.IO Example</h1>
          <button onClick={sendMessage}>Send Message</button>
          {response && <p>Server Response: {response}</p>}
        </div>
      </div>
    </Router>
  );
}

export default App;
