import React, { useEffect, useState, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import ReactHowler from 'react-howler'
import socket, { GameStorage } from '../services/socket';
import styles from './GamePage.module.css';
import roleData from '../data/roleData';
// Fixed the rendering stuff but having everything in game page component is not ideal
// Because some components are flickering and not working as intended, havign rerenders
// Normally everything is separated into components in web projects
//
// This is the example structure for future reference
// /src
//   /components
//     /GamePage
//       GamePage.jsx           # Main container component
//       /RoleActions
//         DoctorAction.jsx     # Doctor-specific component
//         MafiaVoting.jsx      # Mafia-specific component  
//         DetectiveAction.jsx  # Detective-specific component
//       /UI
//         GameTimer.jsx        # Timer component
//         MemoizedTarget.jsx   # Reusable target button
//         PlayerGrid.jsx       # Player display grid
//       /Modals
//         EliminationNotification.jsx
//         InvestigationPopup.jsx
//         DayVotingPopup.jsx
//       /Screens
//         GameOverScreen.jsx   # Game over display
//         RoleRevealScreen.jsx # Role reveal animation
//      etc.

const GameTimer = React.memo(({ phase, time }) => {
  return (
    <div className={styles.timer}>
      {Math.floor(time / 60)}:{String(time % 60).padStart(2, '0')}
    </div>
  );
});

const MemoizedTarget = React.memo(({ player, selectedTarget, handleAction, isDisabled, username, isSelf }) => {
  return (
    <li className={styles.targetItem}>
      <button 
        className={`${styles.targetButton} ${selectedTarget === player.username ? styles.selected : ''} ${isSelf ? styles.self : ''}`}
        onClick={() => handleAction(player.username)}
        disabled={isDisabled}
        data-username={player.username}
      >
        {player.avatar && (
          <img
            src={`/avatars/${player.avatar}`}
            alt={`${player.username}`}
            className={styles.targetAvatar}
          />
        )}
        <span className={`${styles.targetName} ${player.username.length > 10 ? styles.long : ''}`}>
        {player.username}
        </span>
      </button>
    </li>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.selectedTarget === nextProps.selectedTarget &&
    prevProps.isDisabled === nextProps.isDisabled
  );
});

const useTargetSelection = (roomId, gameState, gameSettings, roleType) => {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [playpause, setPlaypause] = useState(false);
  
  useEffect(() => {
    if (gameState.phase === 'night' && gameState.phaseTime === gameSettings.nightDuration) {
      setSelectedTarget(null);
      localStorage.removeItem(`${roleType}_selected_${roomId}`);
    }
  }, [gameState.phase, gameState.phaseTime, gameSettings.nightDuration, roomId, roleType]);
  
  useEffect(() => {
    const savedTarget = localStorage.getItem(`${roleType}_selected_${roomId}`);
    if (savedTarget) {
      setSelectedTarget(savedTarget);
    }
    
    return () => {
      if (gameState.phase !== 'night') {
        localStorage.removeItem(`${roleType}_selected_${roomId}`);
      }
    };
  }, [roleType, roomId, gameState.phase]);
  
  useEffect(() => {
    if (selectedTarget) {
      localStorage.setItem(`${roleType}_selected_${roomId}`, selectedTarget);
    }
  }, [selectedTarget, roomId, roleType]);
  
  const playSound = () => {
    setPlaypause(!playpause);
  };
  
  return { selectedTarget, setSelectedTarget, playpause, playSound };
};

// DayVotingPopup component
const DayVotingPopup = ({ 
  onClose, 
  username,
  hasVotedThisDay,
  setHasVotedThisDay,
  setVotedFor,
  votedFor,
  dayVotes,
  roomId,
  socket,
  alivePlayers
}) => {
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

    setHasVotedThisDay(true);
    setVotedFor(targetUsername);
    setVoteSound(!voteSound);
    
    socket.emit('day_vote', { roomId, targetUsername });
    console.log(`Voted for ${targetUsername}`);
  };

  return (
    <div className={styles.roleInfoModal}>
      <div className={`${styles.roleInfoContent} ${styles.dayVoteModalContent}`}>
        <h3 className={styles.dayVoteTitle}>Cast your vote to eliminate someone</h3>
        <ReactHowler src='../mygtukas.mp3' playing={voteSound} />
        
        <div className={styles.dayVoteTableContainer}>
          <ul className={styles.dayVoteList}>
            {alivePlayers.map(player => (
              <li key={player.username} className={styles.dayVoteRow}>
                <div className={styles.dayVotePlayerInfo}>
                  {player.avatar && (
                    <img
                      src={`/avatars/${player.avatar}`}
                      alt={`${player.username}'s avatar`}
                      className={styles.dayVotePlayerAvatar}
                    />
                  )}
                  <div className={styles.dayVotePlayerDetails}>
                    <div className={styles.dayVoteNameVoteRow}>
                      <span className={styles.dayVotePlayerName}>{player.username}</span>
                      {dayVotes[player.username] > 0 && (
                        <div className={styles.dayVoteCountBadge}>
                          <span>{dayVotes[player.username]}</span>
                          <span>votes</span>
                          <div className={styles.dayVoteIconsContainer}>
                            <span className={styles.dayVoteCountIcon}>⚖️</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleVote(player.username)}
                  disabled={hasVotedThisDay || player.username === username}
                  className={`${styles.dayVoteButton} ${votedFor === player.username ? styles.voted : ''}`}
                >
                  {votedFor === player.username ? 'Voted' : 'Vote'}
                </button>
              </li>
            ))}
          </ul>
        </div>
        
        <div className={styles.dayVoteStatusContainer}>
          {hasVotedThisDay ? (
            <p className={styles.dayVoteStatus}>You voted for: <span className={styles.dayVotedName}>{votedFor}</span></p>
          ) : (
            <p className={styles.dayVoteStatus}>The town awaits your decision</p>
          )}
        </div>
        
        <button onClick={onClose} className={styles.dayVoteCloseButton}>Done</button>
      </div>
    </div>
  );
};


// Doctor Action Component
const DoctorAction = React.memo(({ 
  gameState, gameSettings, username, roomId, styles, 
  hasHealedThisNight, setHasHealedThisNight 
}) => {
  const { selectedTarget, setSelectedTarget, playpause, playSound } = 
    useTargetSelection(roomId, gameState, gameSettings, 'doctor');
  
  if (gameState.phase !== 'night' || gameState.role !== 'Doctor' || !gameState.isAlive) {
    return null;
  }
  
  const handleHeal = (targetUsername) => {

    playSound();    
    if (selectedTarget === targetUsername) return;    
    setSelectedTarget(targetUsername);
    
    socket.emit('doctor_heal', { roomId, targetUsername });
    console.log(`Doctor healing ${targetUsername}`);
    
    setHasHealedThisNight(true);
  };
  
  const validTargets = gameState.players.filter(player => player.isAlive);

  return (
    <div className={`${styles.voteContainer} ${styles.doctorActionContainer}`}>
      <h3>Protect a Player</h3>
      <ReactHowler src='../mygtukas.mp3' playing={playpause} />
      
      {validTargets.length > 0 && (
        <ul className={styles.targetList}>
          {validTargets.map(player => (
            <MemoizedTarget
              key={player.username}
              player={player}
              selectedTarget={selectedTarget}
              handleAction={handleHeal}
              isDisabled={selectedTarget === player.username}
              username={username}
              isSelf={player.username === username}
            />
          ))}
        </ul>
      )}
    </div>
  );
});

// Mafia Voting Component
const MafiaVoting = React.memo(({ 
      gameState, gameSettings, username, roomId, styles, mafiaTeammates = []
  }) => {
    const { selectedTarget, setSelectedTarget, playpause, playSound } = 
      useTargetSelection(roomId, gameState, gameSettings, 'mafia');

    const [mafiaVotes, setMafiaVotes] = useState({});
    
    useEffect(() => {
    }, [mafiaTeammates]);

    useEffect(() => {
      const handleMafiaVoteUpdate = (voteCounts) => {
        console.log("Received mafia vote update:", voteCounts);
        setMafiaVotes(voteCounts);
      };
      
      socket.on('mafia_vote_update', handleMafiaVoteUpdate);
      
      return () => {
        socket.off('mafia_vote_update', handleMafiaVoteUpdate);
      };
    }, []);


  if (gameState.phase !== 'night' || gameState.role !== 'Mafia') {
    return null;
  }
  
  const handleVote = (targetUsername) => {
      playSound();
      
      if (selectedTarget === targetUsername) return;
      setSelectedTarget(targetUsername);

      socket.emit('mafia_vote', { roomId, targetUsername });
      console.log(`Voted for ${targetUsername}`);
    
    };

    const validTargets = gameState.players.filter(player => {
    
    if (!player.isAlive) {
      return false;
    }
    
    if (player.username === username) {
        return false;
      }
    
    const isMafiaTeammate = Array.isArray(mafiaTeammates) && mafiaTeammates.includes(player.username);
    return !isMafiaTeammate;
  });

  return (
    <div className={`${styles.voteContainer} ${styles.mafiaActionContainer}`}>
      <h3>Eliminate a Target</h3>
      <ReactHowler src='../mygtukas.mp3' playing={playpause} />
      
      {validTargets.length > 0 ? (
        <>
          <ul className={styles.targetList}>
            {validTargets.map(player => (
              <li key={player.username} className={styles.targetItem}>
                <button 
                  className={`${styles.targetButton} ${selectedTarget === player.username ? styles.selected : ''}`}
                  onClick={() => handleVote(player.username)}
                  disabled={selectedTarget === player.username}
                  data-username={player.username}
                >
                  {player.avatar && (
                    <img
                      src={`/avatars/${player.avatar}`}
                      alt={`${player.username}`}
                      className={styles.targetAvatar}
                    />
                  )}
                  <span className={`${styles.targetName} ${player.username.length > 10 ? styles.long : ''}`}>
                    {player.username}
                  </span>
                  
                  {mafiaVotes[player.username] > 0 && (
                    <div className={`${styles.mafiaVoteIcons} ${selectedTarget === player.username ? styles.selectedTarget : ''}`}>
                      <span className={styles.mafiaVoteIcon}>
                        <span className={styles.voteCount}>{mafiaVotes[player.username]}</span>
                      </span>
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
          <div className={styles.roleActionNote}>
            {selectedTarget ? `You've chosen to eliminate ${selectedTarget}` : "Choose wisely. The town's fate is in your hands."}
          </div>
        </>
      ) : (
        <p>No valid targets available.</p>
      )}
    </div>
  );
});

// Detective Action Component
const DetectiveAction = React.memo(({ 
  gameState, gameSettings, username, roomId, styles,
  hasInvestigatedThisNight, setHasInvestigatedThisNight 
}) => {
  const { selectedTarget, setSelectedTarget, playpause, playSound } = 
    useTargetSelection(roomId, gameState, gameSettings, 'detective');

  if (gameState.phase !== 'night' || gameState.role !== 'Detective' || !gameState.isAlive) {
    return null;
  }

  const handleInvestigate = (targetUsername) => {
    playSound();
    
    if (selectedTarget === targetUsername) return;
    
    setSelectedTarget(targetUsername);

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
    setHasInvestigatedThisNight(true);
  };

  return (
    <div className={`${styles.voteContainer} ${styles.detectiveActionContainer}`}>
      <h3>Investigate a Suspect</h3>
      <ReactHowler src='../mygtukas.mp3' playing={playpause} />
      
      <ul className={styles.targetList}>
        {gameState.players
          .filter(player => player.isAlive && player.username !== username)
          .map(player => (
            <MemoizedTarget
              key={player.username}
              player={player}
              selectedTarget={selectedTarget}
              handleAction={handleInvestigate}
              isDisabled={hasInvestigatedThisNight}
              username={username}
              isSelf={false}
            />
          ))}
      </ul>
    </div>
  );
});


// Investigation Result Popup
const InvestigationPopup = React.memo(({ 
  showInvestigationPopup, 
  investigationResult,
  setShowInvestigationPopup,
  styles
}) => {
  if (!showInvestigationPopup || !investigationResult) return null;

  return (
    <div className={styles.investigationPopup}>
      <div className={styles.investigationContent}>
        <h3>Investigation Result</h3>
        <p>Player: {investigationResult.target}</p>
        <p className={investigationResult.isMafia ? styles.investigationMafiaResult : styles.investigationTownResult}>
          {investigationResult.isMafia ? 'MAFIA' : 'NOT MAFIA'}
        </p>
        <button onClick={() => setShowInvestigationPopup(false)} className={styles.investigationCloseButton}>
          Close
        </button>
      </div>
    </div>
  );
});

// RoleInfoModal component
const RoleInfoModal = React.memo(({ role, onClose }) => {
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
});

// Instructions for the game
const Instructions = React.memo(({ instructions, onClose }) => {
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
});

// Roles section component
const RolesSection = React.memo(({ styles, roleData }) => {
  const [selectedRole, setSelectedRole] = useState(null);
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const gameInstructions = {
    name: "Mafia Game – Quick Rules",
    description:
      "Each player is secretly assigned a role: either Mafia or Town. The Mafia work together to eliminate others, while the Town tries to identify and vote out the Mafia.",
    day:
      "When day breaks, the players discuss and accuse each other. Everyone votes, and the player with the most votes is eliminated. Choose wisely—every vote counts.",
    night:
      "As night falls, the Mafia secretly select someone to eliminate. Meanwhile, the Doctor chooses one player to protect, and the Detective investigates one player's role. All night actions happen in secret and are revealed when the sun rises.",
  };

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setShowRoleInfo(true);
  };

  const handleCloseRoleInfo = () => {
    setShowRoleInfo(false);
  };

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
});


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
  const [globalMafiaTeammates, setGlobalMafiaTeammates] = useState([]);

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
  /* eslint-disable-next-line no-unused-vars */ 
  const [showGameScreen, setShowGameScreen] = useState(false);
  /* eslint-disable-next-line no-unused-vars */ 
  const [showRoles, setShowRoles] = useState(false); 
  const [isFadingOut, setIsFadingOut] = useState(false);
  
  // ===== PHASE TRANSITION STATE =====
  const [isPhaseTransitioning, setIsPhaseTransitioning] = useState(false);
  const [isFadingOutTransition, setIsFadingOutTransition] = useState(false); 
  const [transitionPhase, setTransitionPhase] = useState(null);
  
  // ===== CHAT STATE =====
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // ===== DETECTIVE STATE =====
  const [investigationResult, setInvestigationResult] = useState(null); // { target: string, isMafia: boolean }
  const [showInvestigationPopup, setShowInvestigationPopup] = useState(false);
  const [hasInvestigatedThisNight, setHasInvestigatedThisNight] = useState(false);

  // ===== DOCTOR STATE =====
  const [hasHealedThisNight, setHasHealedThisNight] = useState(false);

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

  const showEliminationNotification = useCallback((newNotification, displayMs = 5000) => {
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
  }, [
    showNotification,
    eliminationNotification,
    setEliminationNotification,
    setNotificationAnimation,
    setNotificationStatic,
    setShowNotification,
    lastNotificationRef,
    notificationTimeoutRef
  ]);

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

  useEffect(() => {
    const handleMafiaTeammates = (teammates) => {
      console.log("GamePage received mafia teammates:", teammates);
      setGlobalMafiaTeammates(teammates);
    };
    
    socket.on('mafia_teammates', handleMafiaTeammates);
    
    return () => {
      socket.off('mafia_teammates', handleMafiaTeammates);
    };
  }, []);

  useEffect(() => {
    if (globalMafiaTeammates.length > 0) {
      console.log("Current mafia teammates:", globalMafiaTeammates);
    }
  }, [globalMafiaTeammates]);



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

      if (data.phase === 'night') {
        setShowVotingPopup(false);
      }
      
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
            setHasHealedThisNight(false);
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
      }, 7500); // Show for 5 seconds
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
  }, [roomId, username, gameSettings, gameFlow, gameState.isAlive, showEliminationNotification]);

  //temp location, idk where to put this yet
    useEffect(() => {
      const handleDayPhaseStart = ({ mafiaAction, players }) => {
        console.log(`Day phase started. Mafia action:`, mafiaAction);
        setGameState(prevState => ({
          ...prevState,
          players,
        }));
      
        setGameFlow('playing');
      
        // Process night actions results
        setTimeout(() => {
          if (!mafiaAction || !mafiaAction.targetUsername) {
            // No mafia target
            showEliminationNotification({ 
              player: "No one", 
              cause: 'mafia',
              protected: false 
            }, 5000);
          } else if (mafiaAction.wasProtected) {
            // Mafia targeted someone, but they were protected
            showEliminationNotification({ 
              player: mafiaAction.targetUsername, 
              cause: 'mafia', 
              protected: true 
            }, 5000);
          } else {
            // Mafia successfully killed their target
            showEliminationNotification({ 
              player: mafiaAction.targetUsername, 
              cause: 'mafia', 
              protected: false 
            }, 5000);
          }
        }, 5000);
      };

      socket.on('day_phase_start', handleDayPhaseStart);
    
      return () => {
        socket.off('day_phase_start', handleDayPhaseStart);
      };
    }, [showEliminationNotification]);

  // ===== EVENT HANDLERS =====
  // Chat message sending
  const sendMessage = () => {
    if (newMessage.trim() !== '') {
      socket.emit('chat_message', { roomId, username, message: newMessage });
      setNewMessage('');
    }
  };

  // Elimination Notification Component
  const EliminationNotification = () => {
    if (!eliminationNotification) return null;
  
    let notificationTypeClass = '';
    if (eliminationNotification.cause === 'vote') {
      notificationTypeClass = eliminationNotification.player === 'No one'
        ? 'noTownNotification'
        : 'townNotification';
    } else if (eliminationNotification.cause === 'mafia') {
      if (eliminationNotification.protected) {
        notificationTypeClass = 'protectedNotification';
      } else {
        notificationTypeClass = eliminationNotification.player === 'No one'
          ? 'noMafiaNotification'
          : 'mafiaNotification';
      }
    } else if (eliminationNotification.cause === 'doctor') {
      notificationTypeClass = 'doctorNotification';
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
            {eliminationNotification.cause === 'vote' ? (
              eliminationNotification.player === 'No one'
                ? `No one was eliminated by the town vote.`
                : <><strong>{eliminationNotification.player}</strong> was eliminated by the town vote!</>
            ) : eliminationNotification.cause === 'mafia' ? (
              eliminationNotification.player === 'No one' 
                ? `No one was targeted by the Mafia during the night.`
                : eliminationNotification.protected
                  ? <><strong>{eliminationNotification.player}</strong> was targeted by the Mafia, but was protected by the Doctor!</>
                  : <><strong>{eliminationNotification.player}</strong> was killed by the Mafia during the night!</>
            ) : (
              <><strong>{eliminationNotification.player}</strong> was revived by the Doctor!</>
            )}
          </p>
        </div>
      </div>
    );
  };


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
          <div className={`${styles.gameContainer} ${gameState.phase === 'day' ? styles.dayPhase : styles.nightPhase}`}>
            <div>
              <div className={styles.header}>
                <div className={styles.centeredPhaseInfo}>
                  <h2>{gameState.phase === 'day' ? 'Day Phase' : 'Night Phase'}</h2>
                  <GameTimer phase={gameState.phase} time={gameState.phaseTime} />
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
                  {gameState.players.map((player) => {
                    const playerCardClass = `${styles.playerCard} ${player.isAlive ? '' : styles.dead} ${
                      gameState.role === 'Mafia' && globalMafiaTeammates.includes(player.username) ? styles.mafiaTeammate : ''
                    }`;
                    return (
                      <div key={player.username} className={playerCardClass}>
                        {player.avatar && (
                          <img 
                            src={`/avatars/${player.avatar}`} 
                            alt={`${player.username}'s avatar`} 
                            className={styles.gamePlayerAvatar}
                          />
                        )}
                        <div className={styles.playerName}>
                          {player.username} 
                        </div>
                        <div className={styles.playerStatus}>
                          {player.isAlive ? 'Alive' : 'Dead'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                {/* Action Buttons Container */}
                  {/* Day Phase Actions */}
                  {gameState.phase === 'day' && gameState.isAlive && (
                    <div className={styles.dayButtonsContainer}>
                      <button
                        className={`${styles.dayVoteOpenButton} ${styles.dayVoteActionButton}`}
                        onClick={() => setShowVotingPopup(true)}
                      >
                        Vote
                      </button>
                    </div>
                  )}
                  {/* Night Phase Actions */}
                  {gameState.phase === 'night' && gameState.isAlive && (
                    <div className={styles.nightActionsContainer}>
                      {gameState.role === 'Mafia' && 
                        <MafiaVoting 
                          gameState={gameState}
                          gameSettings={gameSettings}
                          username={username}
                          roomId={roomId}
                          styles={styles}
                          mafiaTeammates={globalMafiaTeammates}
                        />
                      }
                      {gameState.role === 'Detective' && 
                        <DetectiveAction 
                          gameState={gameState}
                          gameSettings={gameSettings}
                          username={username}
                          roomId={roomId}
                          styles={styles}
                          hasInvestigatedThisNight={hasInvestigatedThisNight}
                          setHasInvestigatedThisNight={setHasInvestigatedThisNight}
                        />
                      }
                      {gameState.role === 'Doctor' && 
                        <DoctorAction 
                          gameState={gameState}
                          gameSettings={gameSettings}
                          username={username}
                          roomId={roomId}
                          styles={styles}
                          hasHealedThisNight={hasHealedThisNight}
                          setHasHealedThisNight={setHasHealedThisNight}
                        />
                      }
                    </div>
                  )}

                {/* Popups */}
                <InvestigationPopup 
                  showInvestigationPopup={showInvestigationPopup}
                  investigationResult={investigationResult}
                  setShowInvestigationPopup={setShowInvestigationPopup}
                  styles={styles}
                />
                {showVotingPopup && (
                  <DayVotingPopup 
                    onClose={() => setShowVotingPopup(false)}
                    username={username}
                    hasVotedThisDay={hasVotedThisDay}
                    setHasVotedThisDay={setHasVotedThisDay}
                    setVotedFor={setVotedFor}
                    votedFor={votedFor}
                    dayVotes={dayVotes}
                    roomId={roomId}
                    socket={socket}
                    alivePlayers={gameState.players.filter(p => p.isAlive)}
                  />
                )}
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
              <RolesSection 
                styles={styles}
                roleData={roleData}
              />
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
