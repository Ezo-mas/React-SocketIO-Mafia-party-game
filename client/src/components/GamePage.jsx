import React, { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ReactHowler from 'react-howler'
import socket, { GameStorage } from '../services/socket';
import styles from './GamePage.module.css';
import roleData from '../data/roleData';


const GamePage = () => {

  // ===== PARAMS & LOCATION STATE =====
  const { roomId } = useParams();
  const location = useLocation();
  const locationState = location.state || {};
  const storedUsername = GameStorage.getUsername();
  const storedSettings = GameStorage.getGameSettings();
  const username = locationState.username || storedUsername || 'Guest';
  const locationGameSettings = locationState.gameSettings || storedSettings;
  const isPageRefresh = useRef(GameStorage.getRefreshing());
  const hasJoined = useRef(false);
  const isInitialGameUpdate = useRef(false)
  const isTransitioningFromLobby = GameStorage.getTransitioning() === roomId;

  // ===== GAME STATE =====
  const [gameFlow, setGameFlow] = useState(isTransitioningFromLobby ? 'loading' : (isPageRefresh ? 'playing' : 'loading'));
  const [gameState, setGameState] = useState({
    phase: 'night',
    phaseTime: 0,
    players: [],
    role: '',
    isAlive: true,
    transitioning: false
  });
  const [gameSettings, setGameSettings] = useState({
    dayDuration: 180,
    nightDuration: 180,
    mafiaPercentage: 30,
    detectiveEnabled: true,
    doctorEnabled: true,
    civilianCount: 0,
  });

  // ===== UI STATE =====
  const [countdown, setCountdown] = useState(0); 
  const [showGameScreen, setShowGameScreen] = useState(false); 
  const [showRoles, setShowRoles] = useState(false); 
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  // ===== PHASE TRANSITION STATE =====
  const [isPhaseTransitioning, setIsPhaseTransitioning] = useState(false);
  const [isFadingOutTransition, setIsFadingOutTransition] = useState(false); 
  const [transitionPhase, setTransitionPhase] = useState(null);

  // ===== ROLE INFORMATION STATE =====
  const [selectedRole, setSelectedRole] = useState(null);
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  
  // ===== CHAT STATE =====
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // ===== DETECTIVE STATE =====
  const [investigationResult, setInvestigationResult] = useState(null); // { target: string, isMafia: boolean }
  const [showInvestigationPopup, setShowInvestigationPopup] = useState(false);
  const [hasInvestigatedThisNight, setHasInvestigatedThisNight] = useState(false);

  // ===== DAY VOTING STATE =====
  const [showVotingPopup, setShowVotingPopup] = useState(false);
  const [dayVotes, setDayVotes] = useState({}); // { username: count }
  const [hasVotedThisDay, setHasVotedThisDay] = useState(false);
  const [votedFor, setVotedFor] = useState(null); // Track who the current player voted for
  
  // ===== ELIMINATION NOTIFICATION STATES AND ANIMATIONS =====
  const [eliminationNotification, setEliminationNotification] = useState(null); // { player: string, cause: 'vote' | 'mafia' }
  const [showNotification, setShowNotification] = useState(false);
  const [notificationAnimation, setNotificationAnimation] = useState('');
  const lastNotificationRef = useRef(null);
  const notificationTimeoutRef = useRef(null);
  const [ notificationStatic, setNotificationStatic ] = useState(false);
  
  // ===== GAME OVER STATE =====
  const [gameOverData, setGameOverData] = useState({
    winner: null,  
    playerRoles: [] // [{username: 'player1', role: 'Mafia', wasAlive: false}, ...]
  });

  // ===== DEV MODE STATE =====
  const [devMode, setDevMode] = useState(false); 
  const [showDevButton, setShowDevButton] = useState(false);

  // ===== DEV MODE NAV STATE =====
  const toggleDevMode = () => {
    setDevMode(prev => !prev);
  };

  useEffect(() => {
    document.body.classList.add('game-page');
        return () => {
      document.body.classList.remove('game-page');
    };
  }, []);

  // ===== GAME SETUP EFFECTS =====
  // Apply host settings
  useEffect(() => {
    if (locationGameSettings) {
      console.log("Applying host settings:", locationGameSettings);
      setGameSettings(locationGameSettings);
    }
  }, [locationGameSettings]);

  useEffect(() => {
    if (username && username !== 'Guest') GameStorage.setUsername(username);
    if (roomId) GameStorage.setActiveRoom(roomId);
    if (locationGameSettings) GameStorage.setGameSettings(locationGameSettings);
    
    window.addEventListener('beforeunload', () => {
      GameStorage.setRefreshing();
    });
    
    return () => {
      window.removeEventListener('beforeunload', () => {});
    };
  }, [username, roomId, locationGameSettings]);

  useEffect(() => {
    const wasRefreshed = GameStorage.getRefreshing();
    
    if (wasRefreshed) {
      isPageRefresh.current = true;
      GameStorage.clearRefreshing();
      console.log('Page was refreshed, will maintain game state');
      
      const storedRole = GameStorage.getPlayerRole();
      const storedPhase = GameStorage.getGamePhase();
      const isNewRoomCreation = GameStorage.getCreatingRoom() === 'true';
      
      if (isNewRoomCreation) {
        console.log('New room creation detected - using loading state');
        GameStorage.clearCreatingRoom();
        setGameFlow('loading');
      } else if (storedRole || storedPhase) {
        console.log('Game in progress refreshed - using playing state');
        setGameFlow('playing');
      } else {
        console.log('No game in progress - using loading state');
        setGameFlow('loading');
      }
    }
  }, []);

  // ===== SOCKET COMMUNICATION =====
  // Chat messages
  useEffect(() => {
    socket.on('receive_message', (data) => {
      setMessages((prevMessages) => [...prevMessages, data]);
    });

    return () => {
      socket.off('receive_message');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check for Alt+D keyboard shortcut
      if (e.altKey && e.key === 'd') {
        e.preventDefault();
        setShowDevButton(prev => !prev);
        
        
        if (devMode && showDevButton) {
          setDevMode(false);
        }
      }
    };
  
    
    window.addEventListener('keydown', handleKeyDown);
    
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [devMode, showDevButton]); 

  // Main socket event handlers
  useEffect(() => {

    
    if (!hasJoined.current) {
    console.log("GamePage mounting, joining room", roomId);
    socket.emit('join_game', roomId, username);
    hasJoined.current = true;
  }
    
    const clearTransitionFlag = setTimeout(() => {
      if (GameStorage.getTransitioning() === roomId) {
        console.log('Clearing transition flag after delay');
        GameStorage.clearTransitioning();
      }
    }, 2000);
    
    // Socket event handlers
    const handleCountdown = (countdownDuration) => {
      console.log("Countdown started with duration:", countdownDuration);
      setCountdown(countdownDuration);
      setGameFlow('countdown');
      setShowGameScreen(false);
       
    };

    const handleGameStateUpdate = (updatedState) => {
      console.log("Received game state update:", updatedState);

        // Log the players specifically to debug the isAlive status
        if (updatedState.players) {
          console.log("Updated player statuses:", 
            updatedState.players.map(p => `${p.username}: ${p.isAlive ? 'Alive' : 'Dead'}`));
        }
        let newIsAlive = gameState.isAlive;
        if (updatedState.players) {
          const me = updatedState.players.find(p => p.username === username);
          if (me) newIsAlive = me.isAlive;
        }
        
        // Make sure we're replacing the entire players array, not just merging properties
        if (updatedState.players) {
          setGameState(prevState => ({
            ...prevState,
            ...updatedState,
            players: updatedState.players, // Explicitly replace the players array
            isAlive: newIsAlive

          }));
        } else {
          setGameState(prevState => ({
            ...prevState,
            ...updatedState
          }));
        }

      setGameState(prevState => ({
        ...prevState,
        ...updatedState
      }));
      
      setShowRoles(false);

      if (['countdown', 'roleReveal'].includes(gameFlow)) {
        console.log(`Already in ${gameFlow} state, not changing game flow`);
        return;
      }

      if (isInitialGameUpdate.current) {
        console.log("Initial game update received, ensuring we stay in loading state");
        setGameFlow('loading');
        setShowGameScreen(false);
        return
    };

    if (updatedState.phase === "waiting") {
      console.log("Game is in waiting state but showing loading");
      setShowGameScreen(false);
    } else {
      if (isPageRefresh.current) {
        console.log("Page refreshed - going straight to playing state");
        setGameFlow('playing');
      } else {
        console.log("Fresh game start - staying in loading state");
        setGameFlow('loading');
      }
      setShowGameScreen(true);
    }
  };

    const handleCountdownUpdate = (remainingTime) => {
      console.log("Countdown update:", remainingTime);
      setCountdown(remainingTime);
    };

    const handleRoleAssigned = ({ role }) => {
      console.log("Role assigned:", role);
      GameStorage.setPlayerRole(role);
      setGameFlow('roleReveal');
      setShowGameScreen(false);

      setGameState((prev) => ({
        ...prev,
        role,
      }));
      setShowRoles(true);

      
        setTimeout(() => {
          setIsFadingOut(true); 
          setTimeout(() => {
            setShowRoles(false); 
            setIsFadingOut(false); 
            setGameFlow('playing');
            setShowGameScreen(true); 
          }, 1000); // Match the duration of the fade-out animation
        }, 2000); // Role card display duration
    };

    const handlePhaseTimerUpdate = (data) => {
      setGameState(prevState => ({
        ...prevState,
        phaseTime: data.remainingTime
      }));
    };

    const handlePhaseChange = (data) => {
      setTransitionPhase(data.phase);
      setIsPhaseTransitioning(true);
      setIsFadingOutTransition(false);
      
      setTimeout(() => {
        setIsFadingOutTransition(true);
        setTimeout(() => {
          setGameState(prevState => {
            let newIsAlive = prevState.isAlive;
            if (data.players) {
              const me = data.players.find(p => p.username === username);
              if (me) newIsAlive = me.isAlive;
            }
            return {
              ...prevState,
              phase: data.phase,
              players: data.players ? data.players : prevState.players,
              isAlive: newIsAlive
            };
          });
          setIsPhaseTransitioning(false);
          setTransitionPhase(null);
    
          // Reset investigation status at the start of the day phase
          if (data.phase === 'day') {
            setHasInvestigatedThisNight(false);
            console.log("Resetting detective investigation status for day phase.");   
          }
          // Reset day voting status at the start of the night phase
          if (data.phase === 'night') {
            setHasVotedThisDay(false);
            setVotedFor(null);
            setDayVotes({}); // Clear votes visually
            console.log("Resetting day voting status for night phase.");
          }
        }, 1000); // End of inner timeout (fade in)
      }, 4000); // End of outer timeout (transition display)
    };

    const handleGameStarted = (newGameState) => {
      console.log("Game started event received"); // Debugging log
      console.log("Game started with state:", newGameState);
      GameStorage.setGamePhase(newGameState.phase);
      
      if (newGameState.settings) {
        setGameSettings(newGameState.settings);
        GameStorage.setGameSettings(newGameState.settings);
      }
      
      if (newGameState.phase && !newGameState.phaseTime) {
        newGameState.phaseTime = newGameState.phase === 'day' ? 
        gameSettings.dayDuration : 
        gameSettings.nightDuration;
      }
    

      console.log("Setting game flow to 'loading'"); //debugging
      setGameFlow('loading');
      setShowGameScreen(false);
      
      setIsPhaseTransitioning(false);
      setIsFadingOutTransition(false);
      setTransitionPhase(null);
      setGameState(newGameState);
    
      isInitialGameUpdate.current = true;
      setTimeout(() => {
        isInitialGameUpdate.current = false;
      }, 1000);
    };

    const handleGameOver = (data) => {
      console.log("Game over received:", data);
      setGameOverData(data);
      setGameFlow('gameOver');
    };

    

    socket.on('phase_timer_update', handlePhaseTimerUpdate);
    socket.on('phase_change', handlePhaseChange);
    socket.on('start_countdown', handleCountdown);
    socket.on('countdown_update', handleCountdownUpdate); 
    socket.on('assign_role', handleRoleAssigned);
    socket.on('game_started', handleGameStarted);
    socket.on('game_state_update', handleGameStateUpdate);
    socket.on('game_over', handleGameOver);

    // Detective result listener
    const handleDetectiveResult = (result) => {
      console.log("Detective result received:", result);
      setInvestigationResult(result);
      setShowInvestigationPopup(true);
      // Auto-close popup after a few seconds
      setTimeout(() => {
        setShowInvestigationPopup(false);
        setInvestigationResult(null); // Clear result after showing
      }, 5000); // Show for 5 seconds
    };

    socket.on('detective_result', handleDetectiveResult);

    // Day vote update listener
    const handleDayVoteUpdate = (updatedVotes) => {
      console.log("Received day vote update:", updatedVotes);
      setDayVotes(updatedVotes);
    };
    socket.on('day_vote_update', handleDayVoteUpdate);

    // Day vote result listener
    const handleDayVoteResult = ({ eliminatedPlayer }) => {
            let newNotification;
        if (eliminatedPlayer) {
          newNotification = { player: eliminatedPlayer, cause: 'vote' };
        } else {
          newNotification = { player: "No one", cause: 'vote' };
        }

        setTimeout(() => {
          showEliminationNotification(newNotification, 5000);
        }, 5000);
        // Update local state if the eliminated player is the current user
        if (eliminatedPlayer === username) {
          setGameState(prev => ({ ...prev, isAlive: false }));
        }
      // Player list will update via the subsequent phase_change event from the server
    };
    socket.on('day_vote_result', handleDayVoteResult);


    return () => {
      clearTimeout(clearTransitionFlag);

      if (!isPageRefresh.current && !GameStorage.getTransitioning()) {
        socket.emit('leave_game_room', roomId);
      }

      socket.off('start_countdown', handleCountdown);
      socket.off('countdown_update', handleCountdownUpdate);
      socket.off('assign_role', handleRoleAssigned);
      socket.off('game_started', handleGameStarted);
      socket.off('phase_timer_update', handlePhaseTimerUpdate);
      socket.off('phase_change', handlePhaseChange);
      socket.off('game_state_update', handleGameStateUpdate);
      socket.off('detective_result', handleDetectiveResult);
      socket.off('day_vote_update', handleDayVoteUpdate);
      socket.off('day_vote_result', handleDayVoteResult);
      socket.off('game_over', handleGameOver);
    };
  }, [roomId, username, gameSettings, gameFlow]);

  //temp location, idk where to put this yet
    useEffect(() => {
      const handleDayPhaseStart = ({ killedPlayer, players }) => {
        console.log(`Day phase started. Killed player: ${killedPlayer}`);
        setGameState(prevState => ({
          ...prevState,
          players,
        }));

        setGameFlow('playing');

    
        setTimeout(() => {
          const newNotification = killedPlayer
            ? { player: killedPlayer, cause: 'mafia' }
            : { player: "No one", cause: 'mafia' };
      
          showEliminationNotification(newNotification, 5000);
        }, 5000);
      };

      socket.on('day_phase_start', handleDayPhaseStart);
    
      return () => {
        socket.off('day_phase_start', handleDayPhaseStart);
      };
    }, []);

  // ===== EVENT HANDLERS =====
  // Chat message sending
  const sendMessage = () => {
    if (newMessage.trim() !== '') {
      socket.emit('chat_message', { roomId, username, message: newMessage });
      setNewMessage('');
    }
  };

   // Role info handlers
  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setShowRoleInfo(true);
  };

  const handleCloseRoleInfo = () => {
    setShowRoleInfo(false);
  };

  // ===== COMPONENT DEFINITIONS =====
  // Role info modal
  const RoleInfoModal = ({ role, onClose }) => {
    if (!role) return null;

    return (
      <div className={styles.roleInfoModal}>
        <div className={styles.roleInfoContent}>
          <h3>{role.name}</h3>
          <p className={styles.alignment}>{role.alignment}</p>
          <div>
            <img className={styles.roleImage} src={'../' + role.name + '.png'} alt={role.name} />
          </div>
          <p>{role.description}</p>
          <button onClick={onClose} className={styles.closeButton}>Close</button>
        </div>
      </div>
    );
  };

  // Instructions for the game
  const Instructions = ({ instructions, onClose }) => {
    if (!instructions) return null;

    return (
      <div className={styles.roleInfoModal}>
        <div className={styles.roleInfoContent}>
          <h3>{instructions.name}</h3>
          <p>{instructions.description}</p>
          <br />
          <p>{instructions.day}</p>
          <br />
          <p>{instructions.night}</p>
          <button onClick={onClose} className={styles.closeButton}>Close</button>
        </div>
      </div>
    );
  };

  const [showInstructions, setShowInstructions] = useState(false);

  const gameInstructions = {
    name: "Mafia Game – Quick Rules",
    description:
      "Each player is secretly assigned a role: either Mafia or Town. The Mafia work together to eliminate others, while the Town tries to identify and vote out the Mafia.",
    day:
      "When day breaks, the players discuss and accuse each other. Everyone votes, and the player with the most votes is eliminated. Choose wisely—every vote counts.",
    night:
      "As night falls, the Mafia secretly select someone to eliminate. Meanwhile, the Doctor chooses one player to protect, and the Detective investigates one player’s role. All night actions happen in secret and are revealed when the sun rises.",
  };
  

  // Roles section component
  const RolesSection = () => {
    return (
      <div className={styles.rolesSection}>
        <h3>Game Roles</h3>
        <div className={styles.rolesGrid}>
          {roleData.map((role, index) => (
            <div
              key={index}
              className={styles.roleItem}
              onClick={() => handleRoleClick(role)}
            >
              <span className={`${styles.roleBadge} ${styles[role.alignment]}`}>
                {role.name}
              </span>
            </div>
          ))}
        </div>
        {showRoleInfo && (
          <RoleInfoModal
            role={selectedRole}
            onClose={handleCloseRoleInfo}
          />
        )}
        {showInstructions && (
          <Instructions
            instructions={gameInstructions}
            onClose={() => setShowInstructions(false)}
          />
        )}
        <button
          className={styles.instructionsButton}
          onClick={() => setShowInstructions(true)}
        >
          Show Instructions
        </button>
      </div>
    );
  };

    // Mafia voting UI
  const MafiaVoting = () => {

    const [playpause, setPlaypause] = useState(false);


    if (gameState.phase !== 'night' || gameState.role !== 'Mafia') {
      console.log(`Phase: ${gameState.phase}, Role: ${gameState.role}`);
      return null;
    }
    
    

    const handleVote = (targetUsername) => {
      socket.emit('mafia_vote', { roomId, targetUsername });
      console.log(`Voted for ${targetUsername}`);
      setPlaypause(!playpause);
    };

    return (
      <div className={styles.voteContainer}>
        <h3>Vote to Eliminate</h3>
        <ReactHowler
            src='../mygtukas.mp3'
            playing={playpause}
          />
        <ul>
          {gameState.players
            .filter(player => player.isAlive && player.role !== 'Mafia')
            .map(player => (
              <li key={player.username}>
                <button onClick={() => handleVote(player.username)}>
                  {player.username}
                </button>
              </li>
            ))}
        </ul>
      </div>
    );
  };

  // Detective Action UI
  const DetectiveAction = () => {
    const [playpause, setPlaypause] = useState(false); // Sound effect state

    if (gameState.phase !== 'night' || gameState.role !== 'Detective' || !gameState.isAlive) {
      return null; // Only show for alive Detective during the night
    }

    const handleInvestigate = (targetUsername) => {
      if (hasInvestigatedThisNight) {
        alert("You can only investigate one player per night.");
        return;
      }
      if (targetUsername === username) {
        alert("You cannot investigate yourself.");
        return;
      }
      socket.emit('detective_investigate', { roomId, targetUsername });
      console.log(`Detective investigating ${targetUsername}`);
      setHasInvestigatedThisNight(true); // Mark as investigated for this night
      setPlaypause(!playpause); // Trigger sound effect
    };

    return (
      <div className={styles.voteContainer}> {/* Reusing vote container style */}
        <h3>Investigate a Player</h3>
        <ReactHowler
          src='../mygtukas.mp3' // Reusing button sound
          playing={playpause}
        />
        <ul>
          {gameState.players
            .filter(player => player.isAlive && player.username !== username) // Filter alive players, exclude self
            .map(player => (
              <li key={player.username}>
                <button
                  onClick={() => handleInvestigate(player.username)}
                  disabled={hasInvestigatedThisNight} // Disable button after investigation
                >
                  {player.username}
                </button>
              </li>
            ))}
        </ul>
      </div>
    );
  };

   // Investigation Result Popup
   const InvestigationPopup = () => {
    if (!showInvestigationPopup || !investigationResult) return null;

    return (
      <div className={styles.roleInfoModal}> {/* Reusing role info modal style */}
        <div className={styles.roleInfoContent}>
          <h3>Investigation Result</h3>
          <p>Player: {investigationResult.target}</p>
          <p className={investigationResult.isMafia ? styles.mafiaResult : styles.townResult}>
            {investigationResult.isMafia ? 'MAFIA' : 'NOT MAFIA'}
          </p>
          <button onClick={() => setShowInvestigationPopup(false)} className={styles.closeButton}>Close</button>
        </div>
      </div>
    );
  };

  // Day Voting Popup (Truksta dizaino)
  const DayVotingPopup = ({ onClose }) => {
    const [voteSound, setVoteSound] = useState(false);

    const handleVote = (targetUsername) => {
      if (hasVotedThisDay) {
        alert("You have already voted today.");
        return;
      }
      if (targetUsername === username) {
        alert("You cannot vote for yourself.");
        return;
      }

      socket.emit('day_vote', { roomId, targetUsername });
      setHasVotedThisDay(true);
      setVotedFor(targetUsername);
      setVoteSound(!voteSound); 
      console.log(`Voted for ${targetUsername}`);
      // onClose();
    };

    // Get only alive players for voting
    const alivePlayers = gameState.players.filter(p => p.isAlive);

    return (
      <div className={styles.roleInfoModal}>
        <div className={styles.roleInfoContent}>
          <h3>Vote to Eliminate</h3>
          <ReactHowler src='../mygtukas.mp3' playing={voteSound} />
          <ul className={styles.voteList}> 
            {alivePlayers.map(player => (
              <li key={player.username} className={styles.voteListItem}>
                <span>{player.username} ({dayVotes[player.username] || 0} votes)</span>
                <button
                  onClick={() => handleVote(player.username)}
                  disabled={hasVotedThisDay || player.username === username} // Disable if already voted or self
                  className={votedFor === player.username ? styles.votedForButton : ''} // Style the button for the voted player
                >
                  {votedFor === player.username ? 'Voted' : 'Vote'}
                </button>
              </li>
            ))}
          </ul>
          {hasVotedThisDay && <p>You voted for: {votedFor}</p>}
          {!hasVotedThisDay && <p>You have not voted yet.</p>}
          <button onClick={onClose} className={styles.closeButton}>Close</button>
        </div>
      </div>
    );
  };

  // Elimination Notification Component
  const EliminationNotification = () => {
    if (!eliminationNotification) return null;
  
    let notificationTypeClass = '';
    if (eliminationNotification.cause === 'vote') {
      notificationTypeClass = eliminationNotification.player === 'No one'
        ? 'noTownNotification'
        : 'townNotification';
    } else {
      notificationTypeClass = eliminationNotification.player === 'No one'
        ? 'noMafiaNotification'
        : 'mafiaNotification';
    }
  
    const notificationClass = [
      styles.notification,
      showNotification ? styles.show : styles.hide,
      styles[notificationTypeClass],
      notificationAnimation ? styles[notificationAnimation] : '',
      notificationStatic ? styles.static : ''
    ].filter(Boolean).join(' ');
  
    return (
      <div className={notificationClass}>
        <div className={styles.notificationInner}>
          <p>
            {eliminationNotification.cause === 'vote'
              ? eliminationNotification.player === 'No one'
                ? `No one was eliminated by the town vote.`
                : <><strong>{eliminationNotification.player}</strong> was eliminated by the town vote!</>
              : eliminationNotification.player === 'No one'
                ? `No one was killed during the night.`
                : <><strong>{eliminationNotification.player}</strong> was killed by the Mafia during the night!</>}
          </p>
        </div>
      </div>
    );
  };
  
  const showEliminationNotification = (newNotification, displayMs = 5000) => {
    if (
      showNotification &&
      eliminationNotification &&
      eliminationNotification.player === newNotification.player &&
      eliminationNotification.cause === newNotification.cause
    ) {
      return;
    }
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
  
    setEliminationNotification(newNotification);
    setNotificationAnimation('animateIn');
    setNotificationStatic(false);
    setShowNotification(true);
    lastNotificationRef.current = newNotification;
  
    notificationTimeoutRef.current = setTimeout(() => {
      setNotificationAnimation('animateOut');
      setNotificationStatic(false);
      setTimeout(() => {
        setShowNotification(false);
        setEliminationNotification(null);
        notificationTimeoutRef.current = null;
      }, 700);
    }, displayMs);
  };

  useEffect(() => {
    if (notificationAnimation === 'animateIn') {
      const timer = setTimeout(() => {
        setNotificationAnimation('');
        setNotificationStatic(true);
      }, 700); 
      return () => clearTimeout(timer);
    }
  }, [notificationAnimation]);

  useEffect(() => {
    if (!showNotification && notificationAnimation) {
      setNotificationAnimation('');
    }
  }, [showNotification, notificationAnimation]);




  const GameOverScreen = ({ data }) => {

    const navigate = useNavigate();
    const headerRef = useRef(null);

    useEffect(() => {
      if (headerRef.current) {
        headerRef.current.className = styles.gameOverHeader;
      }
    }, []);

    const handleCreateNewGame = () => { 

      GameStorage.setUsername(username);
      const storedUsername = GameStorage.getUsername();

      socket.emit('leave_game_room', roomId);
      const newRoomId = uuidv4().substring(0, 8);
      
      const oldRoomId = GameStorage.getActiveRoom();
      if (oldRoomId) {
        console.log(`Leaving previous room ${oldRoomId} before creating new room`);
        socket.emit('leave_game_room', oldRoomId);
      }
      
      socket.emit('navigation_intent', newRoomId);
      socket.emit('join_room', newRoomId, storedUsername, true);
          
      GameStorage.setTransitioning(newRoomId);
      
      navigate(`/lobby/${newRoomId}`, { 
        state: { 
          username: storedUsername,
          isHost: true,
          gameSettings: gameSettings
        } 
      });
    };

    const handleJoinGame = () => {  
      
      GameStorage.setUsername(username);
      const storedUsername = GameStorage.getUsername();

      socket.emit('leave_game_room', roomId);
      navigate('/joinRoom', { 
        state: { 
          username: storedUsername,
          comingFromGame: true
        } 
      });
    };
  
    const handleReturnHome = () => {
      socket.emit('leave_game_room', roomId);
      window.location.href = '/';
    };
  
    return (
      <div className={styles.gameOverContainer}>
      <h1 ref={headerRef}>
        {data.winner === 'town' ? 'Town Wins!' : 
        data.winner === 'mafia' ? 'Mafia Wins!' : 
        `Jester Wins! ${data.jesterName} fooled everyone!`}
      </h1>
        
      <div className={styles.playerRolesGrid}>
        <h2>Player Roles</h2>
        {data.playerRoles.map((player, index) => (
          <div 
          key={index} 
          className={`${styles.playerRoleCard} ${!player.wasAlive ? styles.deadPlayer : ''}`}
          data-role={player.role}
        >
          <div className={styles.playerRoleName}>{player.username}</div>
          <div className={styles.roleImageWrapper}>
            <img 
              className={styles.gameOverRoleImage} 
              src={'../' + player.role + '.png'} 
              alt={player.role} 
            />
          </div>
          <div className={styles.gameOverRoleInfo}>
            {player.role === 'Mafia' ? (
              <>🔫 <span style={{marginLeft: '5px'}}>Mafia</span></>
            ) : player.role === 'Detective' ? (
              <>🕵️ <span style={{marginLeft: '5px'}}>Detective</span></>
            ) : player.role === 'Doctor' ? (
              <>👨‍⚕️ <span style={{marginLeft: '5px'}}>Doctor</span></>
            ) : player.role === 'Jester' ? (
              <>🤡 <span style={{marginLeft: '5px'}}>Jester</span></>
            ) : (
              <>🧑‍🌾 <span style={{marginLeft: '5px'}}>Civilian</span></>
            )}
          </div>
          <div className={`${styles.playerFinalStatus} ${player.wasAlive ? styles.survived : styles.perished}`}>
            {player.wasAlive ? 
              '✓ Lived to tell the tale' : 
              '✗ Met their demise'}
          </div>
        </div>
        ))}
      </div>
        
        <div className={styles.gameOverButtons}>
          <button onClick={handleCreateNewGame} className={styles.newGameButton}>
            Create New Game
          </button>
          <button onClick={handleJoinGame} className={styles.joinButton}>
            Join Existing Game
          </button>
          <button onClick={handleReturnHome} className={styles.homeButton}>
            Return Home
          </button>
        </div>
      </div>
    );
  };

  const DevModePanel = () => {
    const [showNavBar, setShowNavBar] = useState(false);
    if (!showDevButton) return null;
  
    if (!devMode) {
      return (
        <div className={styles.devModeToggle}>
          <button onClick={toggleDevMode}>Enable Dev Mode</button>
        </div>
      );
    }
  
  const simulateTownWin = () => {
    socket.emit('dev_simulate_game_end', { roomId, winner: 'town' });
  };
  
  const simulateMafiaWin = () => {
    socket.emit('dev_simulate_game_end', { roomId, winner: 'mafia' });
  };
  
  const simulateJesterWin = () => {
    socket.emit('dev_simulate_game_end', { roomId, winner: 'jester' });
  };

  const handleDisableAndHide = () => {
    setDevMode(false);
    setShowDevButton(false);
  };

  const toggleNavigation = () => {
    const newNavState = !showNavBar;
    setShowNavBar(newNavState);
    
    if (newNavState) {
      document.body.classList.remove('game-page');
    } else {
      document.body.classList.add('game-page');
    }
  };
  
  return (
      <div className={styles.devModePanel}>
        <h4>Dev Mode Controls</h4>
        <div className={styles.devModeButtons}>
          <button 
            className={`${styles.gameOverButton} ${styles.townWin}`}
            onClick={simulateTownWin}
          >
            Town Wins
          </button>
          <button 
            className={`${styles.gameOverButton} ${styles.mafiaWin}`}
            onClick={simulateMafiaWin}
          >
            Mafia Wins
          </button>
          <button 
            className={`${styles.gameOverButton} ${styles.jesterWin}`}
            onClick={simulateJesterWin}
          >
            Jester Wins
          </button>
          <button 
            className={`${styles.navToggleButton} ${showNavBar ? styles.active : ''}`}
            onClick={toggleNavigation}
          >
            {showNavBar ? 'Hide Navigation' : 'Show Navigation'}
          </button>
        </div>
        <button 
          className={styles.disableDevButton} 
          onClick={handleDisableAndHide}
        >
          Disable Dev Mode
        </button>
      </div>
    );
  };




  // ===== RENDER LOGIC =====
  // Phase transitions have highest priority
  if (isPhaseTransitioning) {
    const transitionContainerClass = `
      ${styles.animationContainer}
      ${styles.fullscreenTransition}
      ${transitionPhase === 'day' ? styles.day : styles.night}
      ${isFadingOutTransition ? styles.fadingOutTransition : styles.fadeInTransition}
    `;
    return (
      <>
      <div className={transitionContainerClass.trim()}>
        <div className={styles.spinner}>
        <ReactHowler
            src= {((transitionPhase === 'day') ? '../rooster.mp3' : '../crickets.mp3')}
            playing={true}
            volume={0.5}
          />
          <div className={styles.sun}>
          </div>
          <div className={styles.moon}></div>
        </div>
        <div className={styles.stars}></div>
      </div>
      <DevModePanel />
    </>
    );
  }

  // Render appropriate UI based on game flow
  switch(gameFlow) {
    case 'loading':
      return (
        <>
        <div className={styles.countdownContainer}>
          <h1>Preparing Game...</h1>
          <div className={styles.loadingSpinner}>
            <div className={styles.spinnerInner}></div>
          </div>
          <h3>Get ready for the night...</h3>
        </div>
        <DevModePanel />
        </>
      );
    case 'countdown':
      return (
        <>
        <div className={styles.countdownContainer}>
          <h1>Game Starting In...</h1>
          <ReactHowler
            src='../bell.mp3'
            playing={true}
            loop={true}
          />
          <h2 className={countdown <= 3 ? styles.redCountdown : ''}>{countdown} seconds</h2>
        </div>
        <DevModePanel />
        </>
      );
    
    case 'roleReveal':
      return (
        <>
        <div className={`${styles.roleCardsContainer} ${isFadingOut ? styles.fadingOut : ''}`}>
          <div className={styles.roleCard}>
            <h2>Your Role</h2>
            <p className={styles.role}>{gameState.role}</p>
            <div>
              <img className={styles.roleImage} src={'../' + gameState.role + '.png'} alt={gameState.role} />
            </div>
          </div>
        </div>
        <DevModePanel />
      </>
      );
      
      case 'playing':
        return (
          <>
          <div className={styles.gameContainer}>
            <div>
              <div className={styles.header}>
                <div className={styles.centeredPhaseInfo}>
                  <h2>{gameState.phase === 'day' ? 'Day Phase' : 'Night Phase'}</h2>
                  <div className={styles.timer}>
                    {Math.floor(gameState.phaseTime / 60)}:{String(gameState.phaseTime % 60).padStart(2, '0')}
                  </div>
                </div>
              </div>
              <div className={styles.playerRoleInfo}>
                <h3>Your Role: <span className={`${styles.playerRoleText} ${styles[gameState.role.toLowerCase()]}`}>{gameState.role}</span></h3>
                <p className={gameState.isAlive ? styles.aliveStatus : styles.deadStatus}>
                  Status: {gameState.isAlive ? 'Alive' : 'Dead'}
                </p>
              </div>
              <div className={styles.mainContent}>
                <div className={styles.playerGrid}>
                  {gameState.players.map((player, index) => (
                    <div
                      key={index}
                      className={`${styles.playerCard} ${player.isAlive ? '' : styles.dead}`}
                    >
                      <div className={styles.playerName}>
                        {player.username} 
                      </div>
                      <div className={styles.playerStatus}>
                        {player.isAlive ? 'Alive' : 'Dead'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

                      {/* Action Buttons Container */}
                      <div className={styles.actionButtonsContainer}>
                        {/* Day Phase Actions */}
                        {gameState.phase === 'day' && gameState.isAlive && (
                          <button
                            className={styles.voteActionButton} // Add specific style if needed
                            onClick={() => setShowVotingPopup(true)}
                          >
                            Vote
                          </button>
                        )}
                        {/* Night Phase Actions */}
                        {gameState.phase === 'night' && gameState.role === 'Mafia' && gameState.isAlive && <MafiaVoting />}
                        {gameState.phase === 'night' && gameState.role === 'Detective' && gameState.isAlive && <DetectiveAction />}
                      </div>

                      {/* Popups */}
                      <InvestigationPopup />
                      {showVotingPopup && <DayVotingPopup onClose={() => setShowVotingPopup(false)} />}
                      <EliminationNotification />
              <div className={styles['chat-box']}>
                <div className={styles['chat-messages-container']}>
                  {messages.map((msg, index) => (
                    <div key={index} className={styles['chat-message']}>
                      {msg.username}: {msg.message}
                    </div>
                  ))}
                </div>
                <div className={styles['chat-input']}>
                  <input
                    className={styles['chat-input-text']}
                    type="text"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  />
                  <button type="submit" onClick={sendMessage}>Send</button>
                </div>
              </div>
              <RolesSection /> 
            </div>
          </div>
          <DevModePanel />
      </>
        );
      case 'gameOver':
        const isHost = gameState.players.find(p => p.username === username)?.isHost || false;
        return <GameOverScreen data={gameOverData} isHost={isHost} />;
      
    default:
      return (
        <>
        <div className={styles.countdownContainer}>
          <h1>Loading Game...</h1>
          <div className={styles.loadingSpinner}>
            <div className={styles.spinnerInner}></div>
          </div>
        </div>
        <DevModePanel />
        </>
      );
  }
}

export default GamePage;
