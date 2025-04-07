import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import ReactHowler from 'react-howler'
import socket from '../services/socket';
import styles from './GamePage.module.css';
import roleData from '../data/roleData';

const GamePage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const { username } = location.state || { username: 'Guest' };
  const [gameState, setGameState] = useState({
    phase: 'night', // 'day' or 'night'
    phaseTime: 30, // time remaining in current phase
    players: [], // Array of players (without roles)
    role: 'waiting', // Player's assigned role
    isAlive: true,
  });

  // State for managing the fullscreen phase transition
  const [isPhaseTransitioning, setIsPhaseTransitioning] = useState(false);
  const [isFadingOutTransition, setIsFadingOutTransition] = useState(false); // State for fade-out
  const [transitionPhase, setTransitionPhase] = useState(null); // Stores the upcoming phase ('day' or 'night') during transition

  useEffect(() => {
    if (gameState.phaseTime <= 0 || isPhaseTransitioning) {
        if (isPhaseTransitioning && gameState.phaseTime > 0) {
             return;
        }
        if (!isPhaseTransitioning) {
            setIsFadingOutTransition(false);
            setTransitionPhase(null);
        }
        return;
    }

    let intervalId = setInterval(() => {
      setGameState((prevGameState) => {
        if (isPhaseTransitioning) return prevGameState;

        const newTime = prevGameState.phaseTime - 1;

        if (newTime <= 0) {
          const nextPhase = prevGameState.phase === 'night' ? 'day' : 'night';
          setTransitionPhase(nextPhase); // Store the phase for the transition screen
          setIsFadingOutTransition(false); // Ensure fade-out is reset
          setIsPhaseTransitioning(true); // Show the transition screen (fade-in)

          const fadeOutTimer = setTimeout(() => {
            setIsFadingOutTransition(true);

            const endTransitionTimer = setTimeout(() => {
              setGameState(currentState => ({
                ...currentState,
                phase: nextPhase,
                phaseTime: 30,
              }));
              setIsPhaseTransitioning(false); 
              setTransitionPhase(null);
            }, 1000);


          }, 7000);

          return { ...prevGameState, phaseTime: 0 };
        } else {

          return { ...prevGameState, phaseTime: newTime };
        }
      });
    }, 1000);


    return () => {
      clearInterval(intervalId);
    };

  }, [gameState.phaseTime, isPhaseTransitioning]);

  const [selectedRole, setSelectedRole] = useState(null);
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const [countdown, setCountdown] = useState(0); // Countdown timer state
  const [showRoles, setShowRoles] = useState(false); // State to show role cards
  const [isFadingOut, setIsFadingOut] = useState(false); // State to trigger fade-out animation FOR ROLE CARDS
  const [showGameScreen, setShowGameScreen] = useState(false); // State to show the main game screen
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const sendMessage = () => {
    if (newMessage.trim() !== '') {
      socket.emit('chat_message', { roomId, username, message: newMessage });
      setNewMessage('');
    }
  };

  // Function to handle role click
  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setShowRoleInfo(true);
  };

  // Function to close role info
  const handleCloseRoleInfo = () => {
    setShowRoleInfo(false);
  };

  // Role information tooltip/modal
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

  useEffect(() => {
    socket.on('receive_message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    return () => {
      socket.off('receive_message');
    };
  }, [socket]);

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


  useEffect(() => {
    // Join game room
    socket.emit('join_game', roomId, username);

    // Listen for server events
    const handleCountdown = (countdownDuration) => {
      console.log("Countdown started with duration:", countdownDuration);
      setCountdown(countdownDuration);
    };

    const handleCountdownUpdate = (remainingTime) => {
      console.log("Countdown update:", remainingTime);
      setCountdown(remainingTime);
    };

    const handleRoleAssigned = ({ role }) => {
      console.log("Role assigned:", role);
      setGameState((prev) => ({
        ...prev,
        role,
      }));
      setShowRoles(true);

      // Hide the role cards after 7 seconds and show the game screen
        setTimeout(() => {
          setIsFadingOut(true); // Start fade-out animation FOR ROLE CARDS
          setTimeout(() => {
            setShowRoles(false); // Hide role cards
            setIsFadingOut(false); // Reset fade-out state FOR ROLE CARDS
            setShowGameScreen(true); // Show the main game screen
          }, 1000); // Match the duration of the fade-out animation
        }, 2000); // Role card display duration
    };

    const handleGameStarted = (newGameState) => {
      console.log("Game started with state:", newGameState);
      // Ensure phase transition state is reset if game starts fresh
      setIsPhaseTransitioning(false);
      setIsFadingOutTransition(false);
      setTransitionPhase(null);
      setGameState(newGameState);
    };

    socket.on('start_countdown', handleCountdown);
    socket.on('countdown_update', handleCountdownUpdate); // Listen for countdown updates
    socket.on('assign_role', handleRoleAssigned);
    socket.on('game_started', handleGameStarted);

    return () => {
      socket.off('start_countdown', handleCountdown);
      socket.off('countdown_update', handleCountdownUpdate);
      socket.off('assign_role', handleRoleAssigned);
      socket.off('game_started', handleGameStarted);
    };
  }, [roomId, username]);

  // ---- RENDER LOGIC ----

  // 1. Render fullscreen transition if active
  if (isPhaseTransitioning) {
    // Apply fade-in initially, then fade-out when isFadingOutTransition is true
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

  // 2. Render countdown if active
  if (countdown > 0) {
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
  }

  // 3. Render role reveal if active (using the original isFadingOut state for role cards)
  if (showRoles) {
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
  }

  // 4. Render main game screen if active
  if (showGameScreen) {
    return (
      // The main container for the game view
      <div className={styles.gameContainer}>

        <div>
          <div className={styles.header}>
            <h1>Mafia Game</h1>
            <div className={styles.phaseInfo}>
            <h2>{gameState.phase === 'day' ? 'Day Phase' : 'Night Phase'}</h2>
            <div className={styles.timer}>
              Time remaining: {gameState.phaseTime} seconds
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
        <RolesSection />
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
            />
              <button type="submit" onClick={sendMessage}>Send</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. Render nothing by default if none of the above conditions are met
  return null;
};

export default GamePage;
