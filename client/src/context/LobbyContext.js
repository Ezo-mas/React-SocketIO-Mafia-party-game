import React, { createContext, useState } from 'react';

export const LobbyContext = createContext();

export const LobbyProvider = ({ children }) => {
  const [players, setPlayers] = useState([]);
  const [host, setHost] = useState('');
  const [readyPlayers, setReadyPlayers] = useState([]);
  const [gameSettings, setGameSettings] = useState({
    dayDuration: 30,
    nightDuration: 30,
    mafiaPercentage: 30,
    detectiveEnabled: true,
    doctorEnabled: true,
    civilianCount: 0,
  });

  const addPlayer = (username) => {
    setPlayers((prevPlayers) => {
      if (!prevPlayers.includes(username)) {
        return [...prevPlayers, username];
      }
      return prevPlayers;
    });
  };

  const setRoomHost = (username) => {
    setHost(username);
  };

  const removePlayer = (username) => {
    setPlayers((prevPlayers) => prevPlayers.filter(player => player !== username));
    setReadyPlayers((prevReady) => prevReady.filter(player => player !== username));
  };

  const setPlayerReady = (username) => {
    setReadyPlayers((prevReady) => {
      if (!prevReady.includes(username)) {
        return [...prevReady, username];
      }
      return prevReady;
    });
  };

  const setPlayerNotReady = (username) => {
    setReadyPlayers((prevReady) => prevReady.filter(player => player !== username));
  };

  const updateGameSettings = (newSettings) => {
    setGameSettings(newSettings);
  };

  return (
    <LobbyContext.Provider 
      value={{ 
        players, 
        setPlayers,
        addPlayer, 
        removePlayer,
        readyPlayers,
        setPlayerReady,
        setPlayerNotReady,
        gameSettings,
        updateGameSettings,
        host,
        setRoomHost
      }}
    >
      {children}
    </LobbyContext.Provider>
  );
};
