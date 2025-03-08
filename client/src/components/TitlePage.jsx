import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { LobbyContext } from '../context/LobbyContext';
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080');

const TitlePage = () => {
  const [name, setName] = useState('');
  const navigate = useNavigate();
  const { addPlayer } = useContext(LobbyContext);

  const handleStart = () => {
    if (name.trim()) {
      const roomId = uuidv4();
      addPlayer(name);
      socket.emit('join_room', roomId, name);
      navigate(`/lobby/${roomId}`, { state: { username: name } });
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h1>Welcome to the Mafia Party Game</h1>
      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: '0.5rem', fontSize: '1rem' }}
      />
      <br />
      <button onClick={handleStart} style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Start
      </button>
    </div>
  );
};

export default TitlePage;