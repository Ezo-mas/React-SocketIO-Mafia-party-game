import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { LobbyContext } from '../context/LobbyContext';
import { io } from 'socket.io-client';

const socket = io(process.env.REACT_APP_SERVER_URL);

const TitlePage = () => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const { addPlayer } = useContext(LobbyContext);

  const handleCreateRoom = () => {
    if (name.trim()) {
      const newRoomId = uuidv4();
      addPlayer(name);
      socket.emit('join_room', newRoomId, name);
      navigate(`/lobby/${newRoomId}`, { state: { username: name } });
    } else {
      alert('Please enter your name.');
    }
  };

  const handleJoinRoom = () => {
    if (name.trim() && roomId.trim()) {
      addPlayer(name);
      socket.emit('join_room', roomId, name);
      navigate(`/lobby/${roomId}`, { state: { username: name } });
    } else if (!name.trim()) {
      alert('Please enter your name.');
    } else if (!roomId.trim()) {
      alert('Please enter the room ID.');
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
      <button onClick={handleCreateRoom} style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Create Room
      </button>
      <br />
      <input
        type="text"
        placeholder="Enter room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        style={{ marginTop: '1rem', padding: '0.5rem', fontSize: '1rem' }}
      />
      <br />
      <button onClick={handleJoinRoom} style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Join Room
      </button>
    </div>
  );
};

export default TitlePage;