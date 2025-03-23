import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { LobbyContext } from '../context/LobbyContext';
import { io } from 'socket.io-client';
import styles from './LobbyPage.module.css';

import Countdown, { zeroPad } from 'react-countdown' ;

const socket = io(process.env.REACT_APP_SERVER_URL);

const LobbyPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const username = location.state?.username || 'Guest';
  const { players, addPlayer } = useContext(LobbyContext);
  const [inviteLink, setInviteLink] = useState('');
  const [copyStatus, setCopyStatus] = useState(null);

  useEffect(() => {
    if (roomId) {
      setInviteLink(roomId);
      socket.emit('join_room', roomId, username);

      const handlePlayerJoined = (newPlayer) => {
        if (!players.includes(newPlayer)) {
          addPlayer(newPlayer);
        }
      };

      const handleGameStarted = () => {
        alert('The game has started!');
        // Add logic to transition to the game screen
      };

      socket.on('player_joined', handlePlayerJoined);
      socket.on('game_started', handleGameStarted);

      return () => {
        socket.off('player_joined', handlePlayerJoined);
        socket.off('game_started', handleGameStarted);
      };
    }
  }, [roomId, username, addPlayer, players]);

  const handleInvite = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink)
        .then(() => {
          setCopyStatus('success');
          setTimeout(() => setCopyStatus(null), 3000);
        })
        .catch(() => {
          setCopyStatus('error');
          setTimeout(() => setCopyStatus(null), 3000);
        });
    }
  };

  const handleStartLobby = () => {
    if (players.length >= 4 && players.length <= 12) {
      socket.emit('start_game', roomId);
    } else {
      alert('The number of players must be between 4 and 12 to start the game.');
    }
  };

  const handleLockRoom = () => {
    // Čia galite pridėti logiką, kad užrakintumėte kambarį
    alert('Room locked!');
  };

  const handleKickPlayer = (playerToKick) => {
    // Čia galite pridėti logiką, kad išmestumėte žaidėją
    alert(`Player ${playerToKick} kicked!`);
  };

  // Atsakingas už countdown formatavimą. 
  const renderer = ({ minutes, seconds, completed }) => {
    if (completed) {
      // Render a complete state
      return <span>Time's up!</span>;
    } else if (seconds <= 15 && minutes == 0) {
      // Render a panic countdown
      return (<span className={styles.countdownEnding}>
          {zeroPad(minutes)}:{zeroPad(seconds)}
        </span>
      );
    } else {
      // Render a countdown
      return (
        <span>
          {zeroPad(minutes)}:{zeroPad(seconds)}
        </span>
      );
    }
  };

  return (
    <div className={styles['main-container']}>
      <div className={styles.content}>
        <h1 className={styles.countdownTitle}>Time left to buckle up: <Countdown date={Date.now() + 60000} renderer={renderer} className={styles.title}/></h1>
        <h2 className={styles.title}>Welcome, {username}! </h2>
        <p className={styles.inviteText}>Invite your friends to join the lobby:</p>
        
        <input
          type="text"
          value={inviteLink}
          readOnly
          className={styles.input}
        />
        <button onClick={handleInvite} className={styles.button}>
          Copy Invite Link
        </button>
        {copyStatus === 'success' && <p className={styles.copySuccess}>Link copied!</p>}
        {copyStatus === 'error' && <p className={styles.copyError}>Failed to copy.</p>}
        <div className={styles.playersList}>
          <h3 className={styles.playersTitle}>Players in Lobby:</h3>
          <ul className={styles.playersUl}>
            {players.map((player, index) => (
              <li key={index} className={styles.playersLi}>
                {player}
                <button
                  onClick={() => handleKickPlayer(player)}
                  className={styles.kickButton}
                >
                  Kick
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button
          onClick={handleStartLobby}
          disabled={players.length < 4 || players.length > 12}
          className={styles.button}
        >
          Start Lobby
        </button>
        <button onClick={handleLockRoom} className={styles.button}>
          Lock Room
        </button>
      </div>
    </div>
  );
};

export default LobbyPage;
