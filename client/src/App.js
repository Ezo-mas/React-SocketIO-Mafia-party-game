import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { LobbyProvider } from './context/LobbyContext';
import LandingPage from './components/LandingPage'; 
import LobbyPage from './components/LobbyPage';
import AboutPage from './components/AboutPage';
import GamePage from './components/GamePage'; 
import JoinRoom from './components/Join';
import CreateRoom from './components/Create';
import { io } from 'socket.io-client';

const socket = io(process.env.REACT_APP_SERVER_URL); // Define the socket instance

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
                <div className="link"><Link to="/joinRoom" className="link">Join</Link></div>
                <div className="link"><Link to="/createRoom" className="link">Create</Link></div>
              </div>
              <i className="fa-solid fa-bars hamburg" onClick={() => window.hamburg()}></i>
            </div>
            <div className="dropdown">
              <div className="links">
                <Link to="/">Home</Link>
                <Link to="/about">About Us</Link>
                <Link to="/joinRoom" className="link">Join Room</Link>
                <Link to="/createRoom" className="link">Create Room</Link>
                <i className="fa-solid fa-xmark cancel" onClick={() => window.cancel()}></i>
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