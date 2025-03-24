import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import styles from './GamePage.module.css';

const socket = io(process.env.REACT_APP_SERVER_URL);

const GamePage = () => {
  const { roomId } = useParams();
  const location = useLocation();
  const { username, gameSettings } = location.state || { username: 'Guest', gameSettings: {} };
  const [gameState, setGameState] = useState({
    phase: 'night', // 'day' or 'night'
    phaseTime: 0, // time remaining in current phase
    players: location.state?.players || [],
    role: location.state?.role || 'waiting', // player's assigned role
    isAlive: true,
  });

  useEffect(() => {

    socket.emit('join_game', roomId, username);

    const handleGameStateUpdate = (newState) => {
      console.log('Game state update received:', newState);
      setGameState(prevState => ({
        ...prevState,
        players: newState.players.map(player => {
          const existingPlayer = prevState.players.find(p => p.id === player.id);
          if (existingPlayer) {
            return { ...player, isAlive: existingPlayer.isAlive };
          } else {
            return player;
          }
        }),
      }));
    };

    const handleRoleAssigned = (role) => {
      console.log('Role assigned:', role);
      setGameState(prev => {
        const updatedPlayers = prev.players.map(player => {
          if (player.username === username) {
            return { ...player, role: role };
          } else {
            return player;
          }
        });
        return {
          ...prev,
          players: updatedPlayers,
        };
      });
    };

    socket.on('game_state_update', handleGameStateUpdate);
    socket.on('role_assigned', handleRoleAssigned);
    socket.on('game_started', (data) => {
      console.log('Game started:', data);
      setGameState(prevState => ({
        ...prevState,
        role: data.role,
      }));
      navigate(`/game/${roomId}`, {
        state: {
          username,
          gameSettings,
          role: data.role,
        }
      });
    });

    return () => {
      socket.off('game_state_update', handleGameStateUpdate);
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('game_started', () => {});
    };
  }, [roomId, username]);

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
                {player.username} ({player.role})
                {/* {player.username} {player.username === username && "(You)"} */}
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
};

export default GamePage;
