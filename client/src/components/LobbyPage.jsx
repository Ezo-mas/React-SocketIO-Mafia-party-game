// LobbyPage.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';

const LobbyPage = () => {
  const location = useLocation();
  const username = location.state?.username || 'Guest';

  return (
    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h2>Welcome, {username}!</h2>
      {/* Add additional lobby functionality here */}
    </div>
  );
};

export default LobbyPage;
