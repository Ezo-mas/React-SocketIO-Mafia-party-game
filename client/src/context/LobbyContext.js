import React, { createContext, useState } from 'react';

export const LobbyContext = createContext();

export const LobbyProvider = ({ children }) => {
  const [players, setPlayers] = useState([]);

  const addPlayer = (username) => {
    setPlayers((prevPlayers) => [...prevPlayers, username]);
  };

  return (
    <LobbyContext.Provider value={{ players, addPlayer }}>
      {children}
    </LobbyContext.Provider>
  );
};