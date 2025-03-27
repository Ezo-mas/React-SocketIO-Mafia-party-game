import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { LobbyContext } from '../context/LobbyContext';
import socket from '../services/socket';
import styles from './LobbyPage.module.css';
import Countdown, { zeroPad } from 'react-countdown';

const LobbyPage = () => {
  // Router hooks
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const username = location.state?.username || 'Guest';
  
  // Context hooks
  const { players, addPlayer, setPlayers, host, setRoomHost } = useContext(LobbyContext);
  
  // Player state
  const [isReady, setIsReady] = useState(false);
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  
  // UI state
  const [inviteLink, setInviteLink] = useState('');
  const [copyStatus, setCopyStatus] = useState(null);
  const [disabledKickButtons, setDisabledKickButtons] = useState({});
  const [roomLocked, setRoomLocked] = useState(false);
  
  // Timer state
  const [lobbyStartTime, setLobbyStartTime] = useState(Date.now());
  const [countdownDuration, setCountdownDuration] = useState(60000);
  
  // Game settings state
  const [gameSettings, setGameSettings] = useState({
    dayDuration: 120,
    nightDuration: 60,
    mafiaPercentage: 30,
    detectiveEnabled: true,
    doctorEnabled: true,
    civilianCount: 0,
  });

  // Main useEffect for socket events and room setup
  useEffect(() => {
    if (!roomId) return;
    
    // Initialize room
    setInviteLink(`${window.location.origin}/lobby/${roomId}`);
    const isUserHost = location.state?.isHost || false;
    setIsHost(isUserHost);
    
    if (isUserHost && !host) {
      setRoomHost(username);
    }
    
    socket.emit('join_room', roomId, username, isUserHost);
    socket.emit('get_lobby_timer', roomId);

    // Socket event handlers
    const handleLobbyTimer = (startTime, duration) => {
      setLobbyStartTime(startTime);
      setCountdownDuration(duration);
    };

    const handleRoomPlayersList = (playersList, readyPlayersList) => {
      console.log("Received complete players list:", playersList);
      setPlayers(playersList);
      setReadyPlayers(readyPlayersList);
    };

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

    const handleYouWereKicked = () => {
      alert("You have been kicked from the room.");
      navigate('/');
    };

    const handlePlayerKicked = (kickedPlayer) => {
      console.log(`Player kicked: ${kickedPlayer}`);
    };

    const handleRoomLocked = () => setRoomLocked(true);
    const handleRoomUnlocked = () => setRoomLocked(false);
    const handleSettingsUpdated = (newSettings) => setGameSettings(newSettings);

    // Register socket event listeners
    socket.on('room_players_list', handleRoomPlayersList);
    socket.on('player_joined', handlePlayerJoined);
    socket.on('player_ready', handlePlayerReady);
    socket.on('player_not_ready', handlePlayerNotReady);
    socket.on('game_started', handleGameStarted);
    socket.on('room_locked', handleRoomLocked);
    socket.on('room_unlocked', handleRoomUnlocked);
    socket.on('settings_updated', handleSettingsUpdated);
    socket.on('lobby_timer', handleLobbyTimer);
    socket.on('you_were_kicked', handleYouWereKicked);
    socket.on('player_kicked', handlePlayerKicked);

    // Cleanup socket listeners on component unmount
    return () => {
      socket.off('room_players_list', handleRoomPlayersList);
      socket.off('player_joined', handlePlayerJoined);
      socket.off('player_ready', handlePlayerReady);
      socket.off('player_not_ready', handlePlayerNotReady);
      socket.off('game_started', handleGameStarted);
      socket.off('room_locked', handleRoomLocked);
      socket.off('room_unlocked', handleRoomUnlocked);
      socket.off('settings_updated', handleSettingsUpdated);
      socket.off('lobby_timer', handleLobbyTimer);
      socket.off('you_were_kicked', handleYouWereKicked);
      socket.off('player_kicked', handlePlayerKicked);
    };
  }, [roomId, username, addPlayer, players, navigate, gameSettings, host, location.state, setPlayers, setRoomHost]);

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

  // Event handlers
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
      navigate(`/game/${roomId}`, { 
        state: { 
          username,
          gameSettings
        } 
      });
    } else if (players.length < 4 || players.length > 12) {
      alert('The number of players must be between 4 and 12 to start the game.');
    } else if (readyPlayers.length !== players.length) {
      alert('All players must be ready to start the game.');
    }
  };

  const handleLockRoomToggle = () => {
    if (isHost) {
      socket.emit(roomLocked ? 'unlock_room' : 'lock_room', roomId);
      setRoomLocked(!roomLocked);
    }
  };

  const handleKickPlayer = (playerToKick) => {
    if (isHost && playerToKick !== username) {
      setDisabledKickButtons(prev => ({
        ...prev,
        [playerToKick]: true
      }));
      
      socket.emit('kick_player', roomId, playerToKick);
      
      setTimeout(() => {
        setDisabledKickButtons(prev => ({
          ...prev,
          [playerToKick]: false
        }));
      }, 2000);
    }
  };

  const handleReadyToggle = () => {
    setIsReady(!isReady);
    socket.emit(!isReady ? 'player_ready' : 'player_not_ready', roomId, username);
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

  // Helper variables
  const allPlayersReady = players.length > 0 && readyPlayers.length === players.length;

  // Countdown renderer
  const renderer = ({ minutes, seconds, completed }) => {
    if (completed) {
      return <span>Time's up!</span>;
    } else if (seconds <= 15 && minutes === 0) {
      return (
        <span className={styles.countdownEnding}>
          {zeroPad(minutes)}:{zeroPad(seconds)}
        </span>
      );
    } else {
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
        {/* Countdown timer */}
        <h1 className={styles.countdownTitle}>
          Time left to buckle up: 
          <Countdown 
            date={lobbyStartTime + countdownDuration} 
            renderer={renderer} 
            className={styles.title}
            onComplete={() => console.log("Countdown completed")}
          />
        </h1>
        
        {/* Welcome message */}
        <h2 className={styles.title}>Welcome, {username}!</h2>
        
        {/* Invite link section */}
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
        
        {/* Game settings section - host view */}
        {isHost && (
          <div className={styles.settingsPanel}>
            <h3 className={styles.settingsTitle}>Game Settings</h3>
            
            {/* Day duration */}
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
            
            {/* Night duration */}
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
            
            {/* Mafia percentage */}
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
            
            {/* Detective role toggle */}
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
            
            {/* Doctor role toggle */}
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
            
            {/* Role distribution */}
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
        
        {/* Game settings section - non-host view */}
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
        
        {/* Players list */}
        <div className={styles.playersList}>
          <h3 className={styles.playersTitle}>Players in Lobby: {players.length}/12</h3>
          <ul className={styles.playersUl}>
            {players.map((player) => (
              <div key={player} className={styles['player-item']}>
                <div className={styles['player-info']}>
                  {player} 
                  {readyPlayers.includes(player) && (
                    <span className={styles.readyTag}>Ready</span>
                  )}
                </div>
                {isHost && player !== username && (
                  <button 
                    onClick={() => handleKickPlayer(player)}
                    disabled={disabledKickButtons[player]}
                    className={styles.kickButton}
                    data-player={player}
                  >
                    Kick
                  </button>
                )}
              </div>
            ))}
          </ul>
        </div>
        
        {/* Ready button */}
        <button
          onClick={handleReadyToggle}
          className={isReady ? styles.notReadyButton : styles.readyButton}
          disabled={roomLocked && !isReady}
        >
          {isReady ? "Not Ready" : "Ready"}
        </button>
        
        {/* Host-only controls */}
        {isHost && (
          <>
            <button
              onClick={handleStartGame}
              disabled={!allPlayersReady || players.length < 4 || players.length > 12}
              className={styles.startButton}
            >
              Start Game
            </button>
            
            <button 
              onClick={handleLockRoomToggle} 
              className={styles.lockButton}
            >
              {roomLocked ? "Unlock Room" : "Lock Room"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default LobbyPage;