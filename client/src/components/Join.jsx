import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { LobbyContext } from '../context/LobbyContext';
import styles from './TitlePage.module.css';

const socket = io(process.env.REACT_APP_SERVER_URL);

const Join = () => {
    const [name, setName] = useState('');
    const [roomId, setRoomId] = useState('');
    const navigate = useNavigate();
    const { addPlayer } = useContext(LobbyContext);

    const handleJoinRoom = () => {
        if (name.trim() && roomId.trim()) {
            addPlayer(name);
            socket.emit('join_room', roomId, name, false);
            navigate(`/lobby/${roomId}`, { state: { username: name, isHost: false } });
        } else if (!name.trim()) {
            alert('Please enter your name.');
        } else if (!roomId.trim()) {
            alert('Please enter the room ID.');
        }
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
