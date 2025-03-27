import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LobbyProvider } from './context/LobbyContext';
import TitlePage from './components/TitlePage';
import LobbyPage from './components/LobbyPage';
import LandingPage from './components/LandingPage.jsx';
import AboutPage from './components/AboutPage';
import socket from './services/socket';
import GamePage from './components/GamePage';

function App() {
  useEffect(() => {
    // Clean up socket connection when app unmounts
    return () => {
      console.log('Disconnecting socket on app unmount');
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, []);

  return (
    <LobbyProvider>
      <Router>
        <div>
          <nav>
            <div className="nav-container">
              <div className="logo">
                <span>Mafia Online</span>
              </div>
              <div className="links">
                <div className="link"><Link to="/" id="home-link">Home</Link></div>
                <div className="link"><Link to="/about" id="about-link">About Us</Link></div>
              </div>
              
            </div>
          </nav>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/title" element={<TitlePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/lobby/:roomId" element={<LobbyPage />} />
            <Route path="/game/:roomId" element={<GamePage />} />
          </Routes>
        </div>
      </Router>
    </LobbyProvider>
  );
}

export default App;