import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ReactHowler from 'react-howler'
import socket, { GameStorage } from '../services/socket';
import styles from './GamePage.module.css';
import roleData from '../data/roleData';


const GamePage = () => {

  // ===== PARAMS & LOCATION STATE =====
  const { roomId } = useParams();
  const location = useLocation();
  const locationState = location.state || {};
  const storedUsername = GameStorage.getUsername();
  const storedSettings = GameStorage.getGameSettings();
  const username = locationState.username || storedUsername || 'Guest';
  const locationGameSettings = locationState.gameSettings || storedSettings;
  const isPageRefresh = useRef(GameStorage.getRefreshing());
  const hasJoined = useRef(false);
  const isInitialGameUpdate = useRef(false)
  const isTransitioningFromLobby = GameStorage.getTransitioning() === roomId;

  // ===== GAME STATE =====
  const [gameFlow, setGameFlow] = useState(isTransitioningFromLobby ? 'loading' : (isPageRefresh ? 'playing' : 'loading'));
  const [gameState, setGameState] = useState({
    phase: 'night',
    phaseTime: 0,
    players: [],
    role: '',
    isAlive: true,
    transitioning: false
  });
  const [gameSettings, setGameSettings] = useState({
    dayDuration: 180,
    nightDuration: 180,
    mafiaPercentage: 30,
    detectiveEnabled: true,
    doctorEnabled: true,
    civilianCount: 0,
  });

  // ===== UI STATE =====
  const [countdown, setCountdown] = useState(0); 
  const [showGameScreen, setShowGameScreen] = useState(false); 
  const [showRoles, setShowRoles] = useState(false); 
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  // ===== PHASE TRANSITION STATE =====
  const [isPhaseTransitioning, setIsPhaseTransitioning] = useState(false);
  const [isFadingOutTransition, setIsFadingOutTransition] = useState(false); 
  const [transitionPhase, setTransitionPhase] = useState(null);

  // ===== ROLE INFORMATION STATE =====
  const [selectedRole, setSelectedRole] = useState(null);
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  
  // ===== CHAT STATE =====
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // ===== GAME SETUP EFFECTS =====
  // Apply host settings
  useEffect(() => {
    if (locationGameSettings) {
      console.log("Applying host settings:", locationGameSettings);
      setGameSettings(locationGameSettings);
    }
  }, [locationGameSettings]);

  useEffect(() => {
    if (username && username !== 'Guest') GameStorage.setUsername(username);
    if (roomId) GameStorage.setActiveRoom(roomId);
    if (locationGameSettings) GameStorage.setGameSettings(locationGameSettings);
    
    window.addEventListener('beforeunload', () => {
      GameStorage.setRefreshing();
    });
    
    return () => {
      window.removeEventListener('beforeunload', () => {});
    };
  }, [username, roomId, locationGameSettings]);

  useEffect(() => {
    const wasRefreshed = GameStorage.getRefreshing();
    
    if (wasRefreshed) {
      isPageRefresh.current = true;
      GameStorage.clearRefreshing();
      console.log('Page was refreshed, will maintain game state');
      
      const storedRole = GameStorage.getPlayerRole();
      const storedPhase = GameStorage.getGamePhase();
      const isNewRoomCreation = GameStorage.getCreatingRoom() === 'true';
      
      if (isNewRoomCreation) {
        console.log('New room creation detected - using loading state');
        GameStorage.clearCreatingRoom();
        setGameFlow('loading');
      } else if (storedRole || storedPhase) {
        console.log('Game in progress refreshed - using playing state');
        setGameFlow('playing');
      } else {
        console.log('No game in progress - using loading state');
        setGameFlow('loading');
      }
    }
  }, []);

  // ===== SOCKET COMMUNICATION =====
  // Chat messages
  useEffect(() => {
    socket.on('receive_message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    return () => {
      socket.off('receive_message');
    };
  }, []);

  // Main socket event handlers
  useEffect(() => {

    
    if (!hasJoined.current) {
    console.log("GamePage mounting, joining room", roomId);
    socket.emit('join_game', roomId, username);
    hasJoined.current = true;
  }
    
    const clearTransitionFlag = setTimeout(() => {
      if (GameStorage.getTransitioning() === roomId) {
        console.log('Clearing transition flag after delay');
        GameStorage.clearTransitioning();
      }
    }, 2000);
    
    // Socket event handlers
    const handleCountdown = (countdownDuration) => {
      console.log("Countdown started with duration:", countdownDuration);
      setCountdown(countdownDuration);
      setGameFlow('countdown');
      setShowGameScreen(false);
       
    };

    const handleGameStateUpdate = (updatedState) => {
      console.log("Received game state update:", updatedState);
      setGameState(prevState => ({
        ...prevState,
        ...updatedState
      }));
      
      setShowRoles(false);

      if (['countdown', 'roleReveal'].includes(gameFlow)) {
        console.log(`Already in ${gameFlow} state, not changing game flow`);
        return;
      }

      if (isInitialGameUpdate.current) {
        console.log("Initial game update received, ensuring we stay in loading state");
        setGameFlow('loading');
        setShowGameScreen(false);
        return
    };

    if (updatedState.phase === "waiting") {
      console.log("Game is in waiting state but showing loading");
      setShowGameScreen(false);
    } else {
      if (isPageRefresh.current) {
        console.log("Page refreshed - going straight to playing state");
        setGameFlow('playing');
      } else {
        console.log("Fresh game start - staying in loading state");
        setGameFlow('loading');
      }
      setShowGameScreen(true);
    }
  };

    const handleCountdownUpdate = (remainingTime) => {
      console.log("Countdown update:", remainingTime);
      setCountdown(remainingTime);
    };

    const handleRoleAssigned = ({ role }) => {
      console.log("Role assigned:", role);
      GameStorage.setPlayerRole(role);
      setGameFlow('roleReveal');
      setShowGameScreen(false);

      setGameState((prev) => ({
        ...prev,
        role,
      }));
      setShowRoles(true);

      
        setTimeout(() => {
          setIsFadingOut(true); 
          setTimeout(() => {
            setShowRoles(false); 
            setIsFadingOut(false); 
            setGameFlow('playing');
            setShowGameScreen(true); 
          }, 1000); // Match the duration of the fade-out animation
        }, 2000); // Role card display duration
    };

    const handlePhaseTimerUpdate = (data) => {
      setGameState(prevState => ({
        ...prevState,
        phaseTime: data.remainingTime
      }));
    };

    const handlePhaseChange = (data) => {
      setTransitionPhase(data.phase);
      setIsPhaseTransitioning(true);
      setIsFadingOutTransition(false);
      
      setTimeout(() => {
        setIsFadingOutTransition(true);
        setTimeout(() => {
          setGameState(prevState => ({
            ...prevState,
            phase: data.phase
          }));
          setIsPhaseTransitioning(false);
          setTransitionPhase(null);
        }, 1000);
      }, 4000);
    };

    const handleGameStarted = (newGameState) => {
      console.log("Game started with state:", newGameState);
      GameStorage.setGamePhase(newGameState.phase);
      
      if (newGameState.settings) {
        setGameSettings(newGameState.settings);
        GameStorage.setGameSettings(newGameState.settings);
      }
      
      if (newGameState.phase && !newGameState.phaseTime) {
        newGameState.phaseTime = newGameState.phase === 'day' ? 
        gameSettings.dayDuration : 
        gameSettings.nightDuration;
      }
    
      setGameFlow('loading');
      setShowGameScreen(false);
      
      setIsPhaseTransitioning(false);
      setIsFadingOutTransition(false);
      setTransitionPhase(null);
      setGameState(newGameState);
    
      isInitialGameUpdate.current = true;
      setTimeout(() => {
        isInitialGameUpdate.current = false;
      }, 1000);
    };

    socket.on('phase_timer_update', handlePhaseTimerUpdate);
    socket.on('phase_change', handlePhaseChange);
    socket.on('start_countdown', handleCountdown);
    socket.on('countdown_update', handleCountdownUpdate); 
    socket.on('assign_role', handleRoleAssigned);
    socket.on('game_started', handleGameStarted);
    socket.on('game_state_update', handleGameStateUpdate);


    return () => {
      clearTimeout(clearTransitionFlag);

      if (!isPageRefresh.current && !GameStorage.getTransitioning()) {
        socket.emit('leave_game_room', roomId);
      }

      socket.off('start_countdown', handleCountdown);
      socket.off('countdown_update', handleCountdownUpdate);
      socket.off('assign_role', handleRoleAssigned);
      socket.off('game_started', handleGameStarted);
      socket.off('phase_timer_update', handlePhaseTimerUpdate);
      socket.off('phase_change', handlePhaseChange);
      socket.off('game_state_update', handleGameStateUpdate);
    };
  }, [roomId, username, gameSettings, gameFlow]);

  // ===== EVENT HANDLERS =====
  // Chat message sending
  const sendMessage = () => {
    if (newMessage.trim() !== '') {
      socket.emit('chat_message', { roomId, username, message: newMessage });
      setNewMessage('');
    }
  };

   // Role info handlers
  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setShowRoleInfo(true);
  };

  const handleCloseRoleInfo = () => {
    setShowRoleInfo(false);
  };

  // ===== COMPONENT DEFINITIONS =====
  // Role info modal
  const RoleInfoModal = ({ role, onClose }) => {
    if (!role) return null;

    return (
      <div className={styles.roleInfoModal}>
        <div className={styles.roleInfoContent}>
          <h3>{role.name}</h3>
          <p className={styles.alignment}>{role.alignment}</p>
          <div>
           <img className={styles.roleImage} src={'../' + role.name + '.png'} alt={role.name} />
          </div>
          <p>{role.description}</p>
          <button onClick={onClose} className={styles.closeButton}>Close</button>
        </div>
      </div>
    );
  };

   // Roles section component
   const RolesSection = () => {
    return (
      <div className={styles.rolesSection}>
        <h3>Game Roles</h3>
        <div className={styles.rolesGrid}>
          {roleData.map((role, index) => (
            <div
              key={index}
              className={styles.roleItem}
              onClick={() => handleRoleClick(role)}
            >
              <span className={`${styles.roleBadge} ${styles[role.alignment]}`}>
                {role.name}
              </span>
            </div>
          ))}
        </div>
        {showRoleInfo && (
          <RoleInfoModal
            role={selectedRole}
            onClose={handleCloseRoleInfo}
          />
        )}
      </div>
    );
  };

  // ===== RENDER LOGIC =====
  // Phase transitions have highest priority
  if (isPhaseTransitioning) {
    const transitionContainerClass = `
      ${styles.animationContainer}
      ${styles.fullscreenTransition}
      ${transitionPhase === 'day' ? styles.day : styles.night}
      ${isFadingOutTransition ? styles.fadingOutTransition : styles.fadeInTransition}
    `;
    return (
      <div className={transitionContainerClass.trim()}>
        <div className={styles.spinner}>
          <div className={styles.sun}></div>
          <div className={styles.moon}></div>
        </div>
        <div className={styles.stars}></div>
      </div>
    );
  }

  // Render appropriate UI based on game flow
  switch(gameFlow) {
    case 'loading':
      return (
        <div className={styles.countdownContainer}>
          <h1>Preparing Game...</h1>
          <div className={styles.loadingSpinner}>
            <div className={styles.spinnerInner}></div>
          </div>
          <h3>Get ready for the night...</h3>
        </div>
      );
    case 'countdown':
      return (
        <div className={styles.countdownContainer}>
          <h1>Game Starting In...</h1>
          <ReactHowler
            src='../bell.mp3'
            playing={true}
            loop={true}
          />
          <h2 className={countdown <= 3 ? styles.redCountdown : ''}>{countdown} seconds</h2>
        </div>
      );
    
    case 'roleReveal':
      return (
        <div className={`${styles.roleCardsContainer} ${isFadingOut ? styles.fadingOut : ''}`}>
          <div className={styles.roleCard}>
            <h2>Your Role</h2>
            <p className={styles.role}>{gameState.role}</p>
            <div>
              <img className={styles.roleImage} src={'../' + gameState.role + '.png'} alt={gameState.role} />
            </div>
          </div>
        </div>
      );
      
    case 'playing':
      return (
        <div className={styles.gameContainer}>
          <div>
            <div className={styles.header}>
              {/* Remove the "Mafia Game" h1 element and center phase info */}
              <div className={styles.centeredPhaseInfo}>
                <h2>{gameState.phase === 'day' ? 'Day Phase' : 'Night Phase'}</h2>
                <div className={styles.timer}>
                  {Math.floor(gameState.phaseTime / 60)}:{String(gameState.phaseTime % 60).padStart(2, '0')}
                </div>
              </div>
            </div>
            
            <div className={styles.roleInfo}>
              <h3>Your Role: {gameState.role}</h3>
              <p>Status: {gameState.isAlive ? 'Alive' : 'Dead'}</p>
            </div>
    
            <div className={styles.mainContent}>
              <div className={styles.playerGrid}>
                {gameState.players.map((player, index) => (
                  <div
                    key={index}
                    className={`${styles.playerCard} ${player.isAlive ? '' : styles.dead}`}
                  >
                    <div className={styles.playerName}>
                      {player.username}
                    </div>
                    <div className={styles.playerStatus}>
                      {player.isAlive ? 'Alive' : 'Dead'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
    
            <div className={styles.actionArea}>
              <h3>Game Actions</h3>
              <p>Game implementation coming soon...</p>
            </div>


            <div className={styles['chat-box']}>
              <div className={styles['chat-messages-container']}>
                {messages.map((msg, index) => (
                  <div key={index} className={styles['chat-message']}>
                    {msg.username}: {msg.message}
                  </div>
                ))}
              </div>
              <div className={styles['chat-input']}>
                <input
                  className={styles['chat-input-text']}
                  type="text"
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <button type="submit" onClick={sendMessage}>Send</button>
              </div>
            </div>
            <RolesSection />
          </div>
        </div>
      );
      
    default:
      return (
        <div className={styles.countdownContainer}>
          <h1>Loading Game...</h1>
          <div className={styles.loadingSpinner}>
            <div className={styles.spinnerInner}></div>
          </div>
        </div>
      );
  }
}

export default GamePage;
