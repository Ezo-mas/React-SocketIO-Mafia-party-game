import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { LobbyContext } from '../context/LobbyContext';
import { io } from 'socket.io-client';
import styles from './LobbyPage.module.css';

import Countdown, { zeroPad } from 'react-countdown' ;

const socket = io(process.env.REACT_APP_SERVER_URL);

const LobbyPage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username || 'Guest';
  const { players, addPlayer, setPlayers, host, setRoomHost } = useContext(LobbyContext);
  const [inviteLink, setInviteLink] = useState('');
  const [copyStatus, setCopyStatus] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [roomLocked, setRoomLocked] = useState(false);
  const [gameSettings, setGameSettings] = useState({
    dayDuration: 120, // seconds
    nightDuration: 60, // seconds
    mafiaPercentage: 30, // percentage of players who will be mafia
    detectiveEnabled: true,
    doctorEnabled: true,
    civilianCount: 0, // calculated based on other roles
  });

  useEffect(() => {
    if (roomId) {
      setInviteLink(roomId);
      
      const isUserHost = location.state?.isHost || false;
      setIsHost(isUserHost);
    
      if (isUserHost && !host) {
        setRoomHost(username);
      }

      socket.emit('join_room', roomId, username, isUserHost);

      const handlePlayerJoined = (newPlayer) => {
        if (!players.includes(newPlayer)) {
          addPlayer(newPlayer);
        }
      };

      const handlePlayerReady = (readyPlayer) => {
        setReadyPlayers(prev => {
          if (!prev.includes(readyPlayer)) {
            return [...prev, readyPlayer];
          }
          return prev;
        });
      };

      const handlePlayerNotReady = (notReadyPlayer) => {
        setReadyPlayers(prev => prev.filter(player => player !== notReadyPlayer));
      };

      const handleGameStarted = () => {
        navigate(`/game/${roomId}`, { 
          state: { 
            username,
            gameSettings
          } 
        });
      };

      const handleRoomLocked = () => {
        setRoomLocked(true);
      };

      const handleSettingsUpdated = (newSettings) => {
        setGameSettings(newSettings);
      };

      socket.on('player_joined', handlePlayerJoined);
      socket.on('player_ready', handlePlayerReady);
      socket.on('player_not_ready', handlePlayerNotReady);
      socket.on('game_started', handleGameStarted);
      socket.on('room_locked', handleRoomLocked);
      socket.on('settings_updated', handleSettingsUpdated);

      return () => {
        socket.off('player_joined', handlePlayerJoined);
        socket.off('player_ready', handlePlayerReady);
        socket.off('player_not_ready', handlePlayerNotReady);
        socket.off('game_started', handleGameStarted);
        socket.off('room_locked', handleRoomLocked);
        socket.off('settings_updated', handleSettingsUpdated);
      };
    }
  }, [roomId, username, addPlayer, players, navigate, gameSettings]);

  // Calculate civilian count based on other roles
  useEffect(() => {
    if (players.length > 0) {
      const mafiaCount = Math.max(1, Math.floor(players.length * gameSettings.mafiaPercentage / 100));
      let specialRoles = 0;
      if (gameSettings.detectiveEnabled) specialRoles++;
      if (gameSettings.doctorEnabled) specialRoles++;
      
      const civCount = Math.max(0, players.length - mafiaCount - specialRoles);
      
      setGameSettings(prev => ({
        ...prev,
        civilianCount: civCount
      }));
    }
  }, [players.length, gameSettings.mafiaPercentage, gameSettings.detectiveEnabled, gameSettings.doctorEnabled]);

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

  const handleStartGame = () => {
    if (isHost && readyPlayers.length === players.length && players.length >= 4 && players.length <= 12) {
      socket.emit('start_game', roomId, gameSettings);
    } else if (players.length < 4 || players.length > 12) {
      alert('The number of players must be between 4 and 12 to start the game.');
    } else if (readyPlayers.length !== players.length) {
      alert('All players must be ready to start the game.');
    }
  };

  const handleLockRoom = () => {
    if (isHost) {
      socket.emit('lock_room', roomId);
      setRoomLocked(true);
    }
  };

  const handleKickPlayer = (playerToKick) => {
    if (isHost && playerToKick !== username) {
      socket.emit('kick_player', roomId, playerToKick);
      setPlayers(prev => prev.filter(player => player !== playerToKick));
      setReadyPlayers(prev => prev.filter(player => player !== playerToKick));
    }
  };

  const handleReadyToggle = () => {
    setIsReady(!isReady);
    if (!isReady) {
      socket.emit('player_ready', roomId, username);
    } else {
      socket.emit('player_not_ready', roomId, username);
    }
  };

  const handleSettingChange = (setting, value) => {
    const updatedSettings = {
      ...gameSettings,
      [setting]: value
    };
    
    setGameSettings(updatedSettings);
    
    if (isHost) {
      socket.emit('update_settings', roomId, updatedSettings);
    }
  };

  const allPlayersReady = players.length > 0 && readyPlayers.length === players.length;

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
        
        {isHost && (
          <div className={styles.settingsPanel}>
            <h3 className={styles.settingsTitle}>Game Settings</h3>
            <div className={styles.settingRow}>
              <label>Day Duration (seconds):</label>
              <input
                type="number"
                min="60"
                max="300"
                value={gameSettings.dayDuration}
                onChange={(e) => handleSettingChange('dayDuration', parseInt(e.target.value))}
                disabled={!isHost || roomLocked}
                className={styles.settingInput}
              />
            </div>
            <div className={styles.settingRow}>
              <label>Night Duration (seconds):</label>
              <input
                type="number"
                min="30"
                max="180"
                value={gameSettings.nightDuration}
                onChange={(e) => handleSettingChange('nightDuration', parseInt(e.target.value))}
                disabled={!isHost || roomLocked}
                className={styles.settingInput}
              />
            </div>
            <div className={styles.settingRow}>
              <label>Mafia Percentage:</label>
              <input
                type="range"
                min="20"
                max="40"
                value={gameSettings.mafiaPercentage}
                onChange={(e) => handleSettingChange('mafiaPercentage', parseInt(e.target.value))}
                disabled={!isHost || roomLocked}
                className={styles.settingSlider}
              />
              <span>{gameSettings.mafiaPercentage}%</span>
            </div>
            <div className={styles.settingRow}>
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.detectiveEnabled}
                  onChange={(e) => handleSettingChange('detectiveEnabled', e.target.checked)}
                  disabled={!isHost || roomLocked}
                  className={styles.settingCheckbox}
                />
                Detective Role
              </label>
            </div>
            <div className={styles.settingRow}>
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.doctorEnabled}
                  onChange={(e) => handleSettingChange('doctorEnabled', e.target.checked)}
                  disabled={!isHost || roomLocked}
                  className={styles.settingCheckbox}
                />
                Doctor Role
              </label>
            </div>
            <div className={styles.roleDistribution}>
              <h4>Role Distribution (Estimated):</h4>
              <ul>
                <li>Mafia: {Math.floor(players.length * gameSettings.mafiaPercentage / 100)} players</li>
                {gameSettings.detectiveEnabled && <li>Detective: 1 player</li>}
                {gameSettings.doctorEnabled && <li>Doctor: 1 player</li>}
                <li>Civilians: {gameSettings.civilianCount} players</li>
              </ul>
            </div>
          </div>
        )}
        
        {!isHost && (
          <div className={styles.settingsDisplay}>
            <h3 className={styles.settingsTitle}>Game Settings</h3>
            <ul>
              <li>Day Phase: {gameSettings.dayDuration} seconds</li>
              <li>Night Phase: {gameSettings.nightDuration} seconds</li>
              <li>Mafia: {Math.floor(players.length * gameSettings.mafiaPercentage / 100)} players</li>
              {gameSettings.detectiveEnabled && <li>Detective Role: Enabled</li>}
              {gameSettings.doctorEnabled && <li>Doctor Role: Enabled</li>}
              <li>Civilians: {gameSettings.civilianCount} players</li>
            </ul>
          </div>
        )}
        
        <div className={styles.playersList}>
          <h3 className={styles.playersTitle}>Players in Lobby: {players.length}/12</h3>
          <ul className={styles.playersUl}>
            {players.map((player, index) => (
              <li key={index} className={styles.playersLi}>
                {player} {player === username && "(You)"} 
                {readyPlayers.includes(player) && <span className={styles.readyTag}>READY</span>}
                {isHost && player !== username && (
                  <button
                    onClick={() => handleKickPlayer(player)}
                    className={styles.kickButton}
                    disabled={roomLocked}
                  >
                    Kick
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        
        <button
          onClick={handleReadyToggle}
          className={isReady ? styles.notReadyButton : styles.readyButton}
          disabled={roomLocked && !isReady}
        >
          {isReady ? "Not Ready" : "Ready"}
        </button>
        
        {isHost && (
          <>
            <button
              onClick={handleStartGame}
              // disabled={!allPlayersReady || players.length < 4 || players.length > 12}
              className={styles.startButton}
            >
              Start Game
            </button>
            
            <button 
              onClick={handleLockRoom} 
              className={styles.lockButton}
              disabled={roomLocked}
            >
              {roomLocked ? "Room Locked" : "Lock Room"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};


export default LobbyPage;
