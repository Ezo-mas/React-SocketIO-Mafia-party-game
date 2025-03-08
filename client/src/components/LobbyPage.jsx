import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { LobbyContext } from '../context/LobbyContext';
import { io } from 'socket.io-client';

const socket = io('http://localhost:8080');

const LobbyPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const username = location.state?.username || 'Guest';
  const { players, addPlayer } = useContext(LobbyContext);
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    setInviteLink(`${window.location.origin}/lobby/${roomId}`);
    socket.emit('join_room', roomId, username);

    socket.on('player_joined', (newPlayer) => {
      addPlayer(newPlayer);
    });

    socket.on('game_started', () => {
      alert('The game has started!');
      // Add logic to transition to the game screen
    });

    return () => {
      socket.off('player_joined');
      socket.off('game_started');
    };
  }, [roomId, username, addPlayer]);

  const handleInvite = () => {
    navigator.clipboard.writeText(inviteLink);
    alert('Invite link copied to clipboard!');
  };

  const handleStartLobby = () => {
    if (players.length >= 4 && players.length <= 8) {
      socket.emit('start_game', roomId);
    } else {
      alert('The number of players must be between 4 and 8 to start the game.');
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h2>Welcome, {username}!</h2>
      <p>Invite your friends to join the lobby:</p>
      <button onClick={handleInvite}>Copy Invite Link</button>
      <div style={{ marginTop: '2rem' }}>
        <h3>Players in Lobby:</h3>
        <ul>
          {players.map((player, index) => (
            <li key={index}>{player}</li>
          ))}
        </ul>
      </div>
      <button onClick={handleStartLobby} disabled={players.length < 4 || players.length > 8}>
        Start Lobby
      </button>
    </div>
  );
};

export default LobbyPage;