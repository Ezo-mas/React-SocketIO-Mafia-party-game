import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LobbyProvider } from './context/LobbyContext';
import TitlePage from './components/TitlePage';
import LobbyPage from './components/LobbyPage';
import LandingPage from './components/LandingPage.jsx';
import AboutPage from './components/AboutPage';
import GamePage from './components/GamePage'; // Import GamePage

function App() {
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
              <i className="fa-solid fa-bars hamburg" onClick={() => window.hamburg()}></i>
            </div>
            <div className="dropdown">
              <div className="links">
                <Link to="/">Home</Link>
                <Link to="/about">About Us</Link>
                <i className="fa-solid fa-xmark cancel" onClick={() => window.cancel()}></i>
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