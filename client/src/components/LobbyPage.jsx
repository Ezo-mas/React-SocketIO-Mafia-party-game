import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { LobbyContext } from '../context/LobbyContext';
import socket, { GameStorage } from '../services/socket';
import styles from './LobbyPage.module.css';
import Countdown, { zeroPad } from 'react-countdown';

const LobbyPage = () => {

  // Dev mode
  const [devMode, setDevMode] = useState(false);

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
    dayDuration: 30,
    nightDuration: 30,
    mafiaPercentage: 30,
    detectiveEnabled: true,
    doctorEnabled: true,
    civilianCount: 0,
  });

  // refs to track current values
  const playersRef = useRef(players); // players will be an array of objects { username, avatar }
  const usernameRef = useRef(username);
  const gameSettingsRef = useRef(gameSettings);
  const lastUpdateTimeRef = useRef({});

  const handleRoomPlayersList = useCallback((playersList, readyPlayersList) => {

    const now = Date.now();
    if (!lastUpdateTimeRef.current.players || 
      (now - lastUpdateTimeRef.current.players) > 500) {
      

    if (JSON.stringify(playersList) !== JSON.stringify(playersRef.current)) {
      setPlayers(playersList); 
    }
    
    if (JSON.stringify(readyPlayersList) !== JSON.stringify(readyPlayers)) {
      setReadyPlayers(readyPlayersList); 
    }
    
    // Update timestamp
    lastUpdateTimeRef.current.players = now;
  }
}, [readyPlayers, setPlayers]);
  
  // refs updated with latest values
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  
  useEffect(() => {
    gameSettingsRef.current = gameSettings;
  }, [gameSettings]);
  
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  
  // First effect - Room initialization
  useEffect(() => {
    if (!roomId) return;
    
    setInviteLink(roomId);
    const isUserHost = location.state?.isHost || false;
    setIsHost(isUserHost);
    
    if (isUserHost && !host) {
      setRoomHost(username);
    }
    
    socket.emit('join_room', roomId, username, isUserHost);

    const updateTimer = setTimeout(() => {  
      socket.emit('get_room_players', roomId);
    }, 500);
    
    return () => {
      clearTimeout(updateTimer);
    };
    
  }, [roomId, username, host, location.state, setRoomHost]);


  // Main useEffect for socket events and room setup
  useEffect(() => {
    if (!roomId) return;
    

    socket.emit('get_lobby_timer', roomId);

    // Socket event handlers
    const handleLobbyTimer = (startTime, duration) => {
      setLobbyStartTime(startTime);
      setCountdownDuration(duration);
    };

    

    const handlePlayerJoined = (newPlayerUsername) => {
      console.log('Player joined (username):', newPlayerUsername);
    };

    const handlePlayerReady = (readyPlayerUsername) => { // readyPlayer is a username string
      setReadyPlayers(prev => {
        if (!prev.includes(readyPlayerUsername)) {
          return [...prev, readyPlayerUsername];
        }
        return prev;
      });
    };

    const handlePlayerNotReady = (notReadyPlayerUsername) => { // notReadyPlayer is a username string
      setReadyPlayers(prev => prev.filter(player => player !== notReadyPlayerUsername));
    };

    const handleGameStarted = () => {
      navigate(`/game/${roomId}`, { 
        state: { 
          username: usernameRef.current,
          gameSettings: gameSettingsRef.current
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

    socket.off('room_players_list');
    socket.off('player_joined');
    socket.off('player_ready');
    socket.off('player_not_ready');
    socket.off('game_started');
    socket.off('room_locked');
    socket.off('room_unlocked');
    socket.off('settings_updated');
    socket.off('lobby_timer');
    socket.off('you_were_kicked');
    socket.off('player_kicked');
    

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
    socket.on('room_players_list', handleRoomPlayersList);

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
      socket.off('room_players_list', handleRoomPlayersList);
    };
  }, [roomId, navigate, addPlayer, handleRoomPlayersList]);

  // Calculate civilian count based on other roles
  useEffect(() => {
    if (players.length > 0) {
      const mafiaCount = Math.max(1, Math.floor(players.length * gameSettings.mafiaPercentage / 100));
      let specialRoles = 0;
      if (gameSettings.detectiveEnabled) specialRoles++;
      if (gameSettings.doctorEnabled) specialRoles++;
      if (gameSettings.jesterEnabled) specialRoles++;
      
      const civCount = Math.max(0, players.length - mafiaCount - specialRoles);
      
      setGameSettings(prev => ({
        ...prev,
        civilianCount: civCount
      }));
    }
  }, [players.length, gameSettings.mafiaPercentage, gameSettings.detectiveEnabled, gameSettings.doctorEnabled, gameSettings.jesterEnabled]);

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
    if (isHost && (devMode || readyPlayers.length === players.length)) {
      // Set a flag in localStorage to indicate we're transitioning to game
      GameStorage.setTransitioning(roomId);
      
      // Emit the start game event
      socket.emit('start_game', roomId, gameSettings, devMode);
      
      // Don't navigate here - wait for the game_started event
    } else if (!devMode && (players.length < 4 || players.length > 12)) {
      alert('The number of players must be between 4 and 12 to start the game.');
    } else if (!devMode && readyPlayers.length !== players.length) {
      alert('All players must be ready to start the game.');
    }
  };

  useEffect(() => {
    // Listen for game started event
    socket.on('game_started', (initialState) => {
      if (initialState && initialState.players) {
        setPlayers(initialState.players); 
      }
      // Navigate to the game page after receiving confirmation
      navigate(`/game/${roomId}`, { 
        state: { 
          username: usernameRef.current, // Use ref for potentially updated username
          gameSettings: gameSettingsRef.current // Use ref for potentially updated gameSettings
        } 
      });
    });
  
    return () => {
      // Only leave the room if we're not transitioning to a game
      if (!GameStorage.getTransitioning()) {
        socket.emit('leave_game_room', roomId);
      }
      socket.off('game_started');
    };
  }, [navigate, roomId, setPlayers]);

  useEffect(() => {
    // Change to Alt+D for "Developer mode" - less likely to conflict with browser shortcuts
    const handleKeyDown = (e) => {
      console.log('Key pressed:', e.key, 'Alt:', e.altKey);
      
      if (e.altKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        console.log('Dev mode shortcut activated');
        const newDevModeState = !devMode;
        setDevMode(newDevModeState); // Directly use setState instead of toggleDevMode
        
        const notification = document.createElement('div');
        notification.textContent = newDevModeState ? 'Dev Mode Activated' : 'Dev Mode Deactivated';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.left = '50%';
        notification.style.transform = 'translateX(-50%)';
        notification.style.backgroundColor = newDevModeState ? '#4CAF50' : '#ff4d4d';
        notification.style.color = 'white';
        notification.style.padding = '10px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '1000';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          document.body.removeChild(notification);
        }, 2000);
      }
    };
  
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [devMode]);


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
          Copy Room Code 
        </button>
        {copyStatus === 'success' && <p className={styles.copySuccess}>Room code copied!</p>}
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

            {/* Jester role toggle */}
            <div className={styles.settingRow}>
              <label>
                <input
                  type="checkbox"
                  checked={gameSettings.jesterEnabled}
                  onChange={(e) => handleSettingChange('jesterEnabled', e.target.checked)}
                  disabled={!isHost || roomLocked}
                  className={styles.settingCheckbox}
                />
                Jester Role
              </label>
            </div>
            {/* Role distribution */}
            <div className={styles.roleDistribution}>
              <h4>Role Distribution (Estimated):</h4>
              <ul>
                <li>Mafia: {Math.floor(players.length * gameSettings.mafiaPercentage / 100)} players</li>
                {gameSettings.detectiveEnabled && <li>Detective: 1 player</li>}
                {gameSettings.doctorEnabled && <li>Doctor: 1 player</li>}
                {gameSettings.jesterEnabled && <li>Jester: 1 player</li>}
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
              {gameSettings.jesterEnabled && <li>Jester Role: Enabled</li>}
              <li>Civilians: {gameSettings.civilianCount} players</li>
            </ul>
          </div>
        )}
        
        {/* Players list */}
        <div className={styles.playersList}>
          <h3 className={styles.playersTitle}>Players in Lobby: {players.length}/12</h3>
          <ul className={styles.playersUl}>
            {players.map((playerObj) => ( // playerObj is { username, avatar }
              <div key={playerObj.username} className={styles['player-item']}>
                <div className={styles['player-info']}>
                  {/* Avatar image removed from LobbyPage display */}
                  {playerObj.username} 
                  {readyPlayers.includes(playerObj.username) && (
                    <span className={styles.readyTag}>Ready</span>
                  )}
                </div>
                {isHost && playerObj.username !== username && (
                  <button 
                    onClick={() => handleKickPlayer(playerObj.username)}
                    disabled={disabledKickButtons[playerObj.username]}
                    className={styles.kickButton}
                    data-player={playerObj.username}
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
              disabled={!devMode && (!allPlayersReady || players.length < 4 || players.length > 12)}
              className={`${styles.startButton} ${devMode ? styles.devModeActive : ''}`}
              >
                {devMode ? "⚡ Start Game" : "Start Game"}
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
