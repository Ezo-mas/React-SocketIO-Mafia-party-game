import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { LobbyContext } from '../context/LobbyContext';
import { io } from 'socket.io-client';

const socket = io(process.env.REACT_APP_SERVER_URL);

const LobbyPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const username = location.state?.username || 'Guest';
  const { players, addPlayer } = useContext(LobbyContext);
  const [inviteLink, setInviteLink] = useState('');

  useEffect(() => {
    console.log('useEffect triggered');
    console.log('roomId:', roomId);
    if (roomId) {
      const link = `${roomId}`;
      setInviteLink(link);
      console.log('Invite link set:', link); // Debug log
      socket.emit('join_room', roomId, username);

      socket.on('player_joined', (newPlayer) => {
        if (!players.includes(newPlayer)) {
          addPlayer(newPlayer);
        }
      });

      socket.on('game_started', () => {
        alert('The game has started!');
        // Add logic to transition to the game screen
      });

      return () => {
        socket.off('player_joined');
        socket.off('game_started');
      };
    }
  }, [roomId, username, addPlayer, players]);

  const handleInvite = () => {
    console.log('handleInvite called');
    console.log('inviteLink:', inviteLink);
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink).then(() => {
        alert('Invite link copied to clipboard!');
      }).catch((err) => {
        console.error('Failed to copy invite link:', err);
        alert('Failed to copy invite link.');
      });
    } else {
      alert('Invite link is not set.');
    }
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