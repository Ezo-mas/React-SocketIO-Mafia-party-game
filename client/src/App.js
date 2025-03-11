import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LobbyProvider } from './context/LobbyContext';
import TitlePage from './components/TitlePage';
import LobbyPage from './components/LobbyPage';

function App() {
  return (
    <LobbyProvider>
      <Router>
        <div>
          <nav style={{ display: 'flex', justifyContent: 'center', padding: '20px', backgroundColor: '#222' }}>
            <Link to="/" style={{ backgroundColor: '#b74b4b', color: 'white', padding: '10px 20px', margin: '0 10px', borderRadius: '5px', textDecoration: 'none' }}>Play</Link>
            <a href="/about.html" style={{ backgroundColor: '#b74b4b', color: 'white', padding: '10px 20px', margin: '0 10px', borderRadius: '5px', textDecoration: 'none' }}>About</a>
          </nav>
          <Routes>
            <Route path="/" element={<TitlePage />} />
            <Route path="/lobby/:roomId" element={<LobbyPage />} />
          </Routes>
        </div>
      </Router>
    </LobbyProvider>
  );
}

export default App;