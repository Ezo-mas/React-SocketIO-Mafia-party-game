<div align="center">
  <h1>React Socket.IO Mafia Party Game</h1>
  <p><em>A real-time social deduction game for friends, powered by React and Socket.IO</em></p>

  <!-- Badges -->
  <a href="https://github.com/Ezo-mas/React-SocketIO-Mafia-party-game/actions/workflows/ci.yml">
  <img src="https://github.com/Ezo-mas/React-SocketIO-Mafia-party-game/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI Status">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/github/license/Ezo-mas/React-SocketIO-Mafia-party-game" alt="License">
  </a>
  <a href="https://railway.app/project/674f457b-7e4d-4038-83f2-e547dac4dd0c">
    <img src="https://img.shields.io/badge/Deployed-Railway-blue?logo=railway" alt="Railway Deployment">
  </a>
</div>

## Table of Contents
- [About](#about)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Game Flow](#game-flow)
- [Configuration](#configuration)
- [Contributing](#contributing)
- [License](#license)

## About
A real-time multiplayer Mafia party game built with React on the frontend and Socket.IO for server-side communication. Perfect for friends who love social deduction games!

## Features
- 🔴 Real-time role assignment and chat  
- 👥 Lobby system with custom room names  
- 🎲 Custom day/night cycles  
- 🛡️ Voting, elimination, protection and investigation mechanics  
- 📊 Live game status dashboard  

## Tech Stack
- **Frontend:** React, Redux (or Context API), Tailwind CSS  
- **Backend:** Node.js, Express, Socket.IO  
- **Testing:** Jest, React Testing Library  
- **Deployment:** Railway (frontend and backend)

## Installation
1. Clone the repo  
   ```bash
   git clone https://github.com/Ezo-mas/React-SocketIO-Mafia-party-game.git
   cd React-SocketIO-Mafia-party-game
2. Install dependencies in both client and server folders
   ```bash
   cd client && npm install
   cd ../server && npm install
3. Start both applications
   ```bash
   # In server/
   npm start
   # In client/
   npm start

## Usage
- Open your browser to http://localhost:3000 for the client
- API server runs on http://localhost:8080
- Create or join a lobby, invite friends, and enjoy!
  
## Game Flow
1. Lobby: Host creates a room, shares the link
2. Role Assignment: Server randomly assigns roles (Mafia, Civilian, etc.)
3. Day/Night Cycles: Everyone chats and votes during the day;
4. Role Functions: Mafia votes to eliminate at night; Doctor protects one player; Detective investigates one player  
5. Elimination: Players are voted out until only Mafia or Town remain — plus one alternative ending ;)

## Configuration
Adjust game settings in real time in the lobby:
- roles distribution
- dayDuration / nightDuration
- role enabled/disabled

## Contributing
Contributions are welcome!
- Fork this repository
- Create your feature branch: git checkout -b feature/YourFeature
- Commit your changes: git commit -m "Add YourFeature"
- Push to the branch: git push origin feature/YourFeature
- Open a Pull Request

## License
Distributed under the MIT License. See LICENSE for more information.
