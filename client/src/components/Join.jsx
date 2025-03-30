import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../services/socket';
import { LobbyContext } from '../context/LobbyContext';
import styles from './TitlePage.module.css';


const Join = () => {
    const [name, setName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [joinError, setJoinError] = useState('');
    const navigate = useNavigate();
    const { addPlayer } = useContext(LobbyContext);

    useEffect(() => {
        const handleRoomLockedError = (lockedRoomId) => {
          console.log("Room locked error received:", lockedRoomId);
          setJoinError(`Room ${lockedRoomId} is locked and cannot be joined.`);
          setTimeout(() => setJoinError(''), 5000);
        };
    
        const handleJoinRoomSuccess = (joinedRoomId) => {
          console.log("Join room success received:", joinedRoomId);
          navigate(`/lobby/${joinedRoomId}`, { state: { username: name, isHost: false } });
        };
    
        // Setup and cleanup socket listeners
        socket.off('room_locked_error');
        socket.off('join_room_success');
        socket.on('room_locked_error', handleRoomLockedError);
        socket.on('join_room_success', handleJoinRoomSuccess);
    
        return () => {
          socket.off('room_locked_error', handleRoomLockedError);
          socket.off('join_room_success', handleJoinRoomSuccess);
        };
      }, [navigate, name]);

    const handleJoinRoom = () => {       
        setJoinError('');
        
        if (!name.trim()) {
            alert('Please enter your name.');
            return;
        }
        
        if (!roomId.trim()) {
            alert('Please enter the room ID.');
            return;
        }
        
        addPlayer(name);
        socket.emit('join_room', roomId, name, false);
    };

    return (
        <section className="join" id="join">
            <div className="content">
                <div className="title"><span>Join a City</span></div>
                <div className="join-details">
                    <div className="left">
                        <img src="black wallpaper.jpg" alt="City Image" />
                    </div>
                    <div className="right">
                        <p>Ready to dive into the criminal underworld? Choose a city to join and immerse yourself in a world of strategy, deception, and intense competition.</p>
                        <br />
                        <p>Enter the city link below to join an existing game.</p>
                        <br />
                        <p><strong>How to Join:</strong></p>
                        <ul>
                            <li>Pick your city carefully - each one offers a different experience.</li>
                            <li>Enter the link provided by the game host.</li>
                            <li>Get ready to play, deceive, and strategize your way through the game!</li>
                        </ul>
                        <br />
                        <div className="form-group">
                            <input
                                type="text"
                                id="name"
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <input
                                type="text"
                                id="roomId"
                                placeholder="Enter room code"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                required
                            />
                        </div>

                        {joinError && (
                            <div className={styles.errorMessage}>
                                {joinError}
                            </div>
                        )}

                        <button onClick={handleJoinRoom} className={styles.button}>
                            Join Room
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Join;
