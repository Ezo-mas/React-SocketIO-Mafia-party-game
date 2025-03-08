// TitlePage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const TitlePage = () => {
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleStart = () => {
    if (name.trim()) {
      // Optionally, store the name in a context or localStorage if needed.
      navigate('/lobby', { state: { username: name } });
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '3rem' }}>
      <h1>Welcome to the Mafia Party Game</h1>
      <input
        type="text"
        placeholder="Enter your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ padding: '0.5rem', fontSize: '1rem' }}
      />
      <br />
      <button onClick={handleStart} style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Start
      </button>
    </div>
  );
};

export default TitlePage;
