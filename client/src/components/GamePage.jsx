import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import socket from '../services/socket';
import styles from './GamePage.module.css';

const GamePage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const { username } = location.state || { username: 'Guest' };
  const [gameState, setGameState] = useState({
    phase: 'night', // 'day' or 'night'
    phaseTime: 0, // time remaining in current phase
    players: [], // Array of players (without roles)
    role: 'waiting', // Player's assigned role
    isAlive: true,
  });

  const [countdown, setCountdown] = useState(0); // Countdown timer state
  const [showRoles, setShowRoles] = useState(false); // State to show role cards
  const [isFadingOut, setIsFadingOut] = useState(false); // State to trigger fade-out animation
  const [showGameScreen, setShowGameScreen] = useState(false); // State to show the main game screen

  useEffect(() => {
    // Join game room
    socket.emit('join_game', roomId, username);

    // Listen for server events
    const handleCountdown = (countdownDuration) => {
      setCountdown(countdownDuration);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            clearInterval(timer);
          }
          return prev - 1;
        });
      }, 1000);
    };

    const handleRoleAssigned = ({ role }) => {
      setGameState((prev) => ({
        ...prev,
        role, // Update only the current player's role
      }));
      setShowRoles(true);

      // Hide the role cards after 7 seconds and show the game screen
      setTimeout(() => {
        setIsFadingOut(true); // Start fade-out animation
        setTimeout(() => {
          setShowRoles(false); // Hide role cards
          setIsFadingOut(false); // Reset fade-out state
          setShowGameScreen(true); // Show the main game screen
        }, 1000); // Match the duration of the fade-out animation
      }, 2000);
    };

    const handleGameStarted = (newGameState) => {
      setGameState(newGameState);
    };

    socket.on('start_countdown', handleCountdown);
    socket.on('assign_role', handleRoleAssigned); // Listen for individual role assignment
    socket.on('game_started', handleGameStarted);

    return () => {
      socket.off('start_countdown', handleCountdown);
      socket.off('assign_role', handleRoleAssigned);
      socket.off('game_started', handleGameStarted);
    };
  }, [roomId, username]);

  if (countdown > 0) {
    // Render the countdown timer
    return (
      <div className={styles.countdownContainer}>
        <h1>Game Starting In...</h1>
        <h2 className={countdown <= 3 ? styles.redCountdown : ''}>{countdown} seconds</h2>
      </div>
    );
  }

  if (showRoles) {
    // Render role card for the current player
    return (
      <div className={`${styles.roleCardsContainer} ${isFadingOut ? styles.fadingOut : ''}`}>
        <div className={styles.roleCard}>
          <h2>Your Role</h2>
          <p className={styles.role}>{gameState.role}</p>
        </div>
      </div>
    );
  }

  if (showGameScreen) {
    // Render the main game screen
    return (
      <div className={styles.gameContainer}>
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
      </div>
    );
  }

  return null; // Render nothing until the countdown, role cards, or game screen is ready
};

export default GamePage;