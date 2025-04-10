import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LobbyProvider } from './context/LobbyContext';
import LandingPage from './components/LandingPage'; 
import LobbyPage from './components/LobbyPage';
import AboutPage from './components/AboutPage';
import GamePage from './components/GamePage'; 
import JoinRoom from './components/Join';
import CreateRoom from './components/Create';
import { GameStorage } from './services/socket';



function App() {
  useEffect(() => {
    const handleBeforeUnload = (event) => {
      // This only runs when the user closes the tab/window
      console.log('User leaving application - saving state');
      GameStorage.setLastSessionTime(Date.now());
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    // Clean up socket connection when app unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
                <div className="link"><Link to="/joinRoom" className="link">Join</Link></div>
                <div className="link"><Link to="/createRoom" className="link">Create</Link></div>
              </div>
            </div>
          </nav>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/lobby/:roomId" element={<LobbyPage />} />
            <Route path="/game/:roomId" element={<GamePage />} />
            <Route path="/joinRoom" element={<JoinRoom />} />
            <Route path="/createRoom" element={<CreateRoom />} />
          </Routes>
        </div>
      </Router>
    </LobbyProvider>
  );
}

export default App;