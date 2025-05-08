import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { LobbyContext } from '../context/LobbyContext';
import socket, { leaveGame, GameStorage } from '../services/socket';

const CreateRoom = () => {
    const [hostName, setHostName] = useState('');
    const [joinError, setJoinError] = useState('');
    const { addPlayer, setRoomHost } = useContext(LobbyContext);
    const navigate = useNavigate();

    // Event handlers
    const handleCreateRoom = () => {
        if (!hostName.trim()) {
            alert('Please enter your name.');
            return;
        }

        const oldRoomId = GameStorage.getActiveRoom();
        if (oldRoomId) {
            console.log(`Leaving previous room ${oldRoomId} before creating new room`);
            leaveGame(oldRoomId);
        }
        
        socket.emit('leave_any_previous_games');
        const newRoomId = uuidv4().substring(0, 8);

        GameStorage.setCreatingRoom(newRoomId);
        addPlayer(hostName);
        setRoomHost(hostName);

        socket.emit('navigation_intent', newRoomId);
        socket.emit('join_room', newRoomId, hostName, true);
    };

    // Socket event handlers
    useEffect(() => {
        const handleRoomLockedError = (lockedRoomId) => {
            console.log("Room locked error received:", lockedRoomId);
            setJoinError(`Room ${lockedRoomId} is locked and cannot be joined.`);
            setTimeout(() => setJoinError(''), 5000);
        };

        const handleJoinRoomSuccess = (joinedRoomId) => {
            console.log("Join room success received:", joinedRoomId);
            navigate(`/lobby/${joinedRoomId}`, { state: { username: hostName, isHost: true } });
        };

        // Setup and cleanup socket listeners
        socket.off('room_locked_error');
        socket.off('join_room_success');
        socket.on('room_locked_error', handleRoomLockedError);
        socket.on('join_room_success', handleJoinRoomSuccess);

        return () => {
            GameStorage.clearCreatingRoom();
            socket.off('room_locked_error', handleRoomLockedError);
            socket.off('join_room_success', handleJoinRoomSuccess);
        };
    }, [navigate, hostName]);

    return (
        <section className="create" id="create">
            <div className="content">
                <div className="title"><span>Create a City</span></div>
                <div className="create-details">
                    <div className="left">
                        <img src="OHedN0iv.jpg" alt="City Image" />
                    </div>
                    <div className="right">
                        <p>Welcome, boss! Are you ready to take control and create your own Mafia city? By creating a new game room, you become the <strong>Don</strong>—the leader of your own criminal empire. You’ll set the stage for an intense, strategic battle where only the strongest, most cunning players will survive.</p>
                        <br />
                        <p>Before you create your city, please provide your name.</p>
                        <br />
                        <p><strong>How to Create Your City:</strong></p>
                        <ul>
                            <li>Enter your name.</li>
                            <li>Click the "Create Room" button to generate your unique room code.</li>
                            <li>Share the code with your friends or anyone you want to join your game.</li>
                            <li>As the city creator, you’re the boss—be ready to make tough decisions!</li>
                        </ul>

                        {joinError && <p className="error">{joinError}</p>}

                        <div className="form-group">
                            <input
                                type="text"
                                id="hostName"
                                placeholder="Enter your name"
                                value={hostName}
                                onChange={(e) => setHostName(e.target.value)}
                                required
                            />
                        </div>

                        <div className="button">
                            <button onClick={handleCreateRoom}>
                                Create Room
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CreateRoom;
