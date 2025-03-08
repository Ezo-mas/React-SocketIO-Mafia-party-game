import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LobbyProvider } from './context/LobbyContext';
import TitlePage from './components/TitlePage';
import LobbyPage from './components/LobbyPage';

function App() {
  return (
    <LobbyProvider>
      <Router>
        <div>
          {/* Define your routes */}
          <Routes>
            <Route path="/" element={<TitlePage />} />
            <Route path="/lobby/:roomID" element={<LobbyPage />} />
          </Routes>
        </div>
      </Router>
    </LobbyProvider>
  );
}

export default App;