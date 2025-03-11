import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { LobbyContext } from '../context/LobbyContext';
import { io } from 'socket.io-client';
import styles from './TitlePage.module.css';

const socket = io(process.env.REACT_APP_SERVER_URL);

const TitlePage = () => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();
  const { addPlayer } = useContext(LobbyContext);
  const textRef = useRef(null);

  useEffect(() => {
    const texts = [" Mafioso", " Detective", " Civilian", " Insider"];
    let index = 0;
    let charIndex = 0;
    let isDeleting = false;

    const typeWriter = () => {
      if (textRef.current) {
        const currentText = texts[index];
        if (!isDeleting) {
          textRef.current.textContent = currentText.substring(0, charIndex + 1);
          charIndex++;
        } else {
          textRef.current.textContent = currentText.substring(0, charIndex - 1);
          charIndex--;
        }

        if (charIndex === currentText.length + 10 && !isDeleting) {
          isDeleting = true;
        }

        if (charIndex === 0 && isDeleting) {
          isDeleting = false;
          index = (index + 1) % texts.length;
        }

        setTimeout(typeWriter, isDeleting ? 50 : 100);
      }
    };

    typeWriter();

    return () => clearTimeout(typeWriter);
  }, []);


  const handleCreateRoom = () => {
    if (name.trim()) {
      const newRoomId = uuidv4();
      addPlayer(name);
      socket.emit('join_room', newRoomId, name);
      navigate(`/lobby/${newRoomId}`, { state: { username: name } });
    } else {
      alert('Please enter your name.');
    }
  };

  const handleJoinRoom = () => {
    if (name.trim() && roomId.trim()) {
      addPlayer(name);
      socket.emit('join_room', roomId, name);
      navigate(`/lobby/${roomId}`, { state: { username: name } });
    } else if (!name.trim()) {
      alert('Please enter your name.');
    } else if (!roomId.trim()) {
      alert('Please enter the room ID.');
    }
  };

  return (
    <div style={{ backgroundColor: 'black', minHeight: '100vh' }}>
      <section>
        <div className={styles['main-container']}>
          <div className={styles.image}>
            <img src="Nameless_.jpg" alt="Mafia Online Image" />
          </div>

          <div className={styles.content}>
            <div className={styles.typewriter}>
              I'm a
              <span ref={textRef} className={styles['typewriter-text']}></span>
              <label>|</label>
            </div>

            <br />
            <br />

            <h1>Step into the world of <span>Mafia</span></h1>
            <p>
              Welcome to Mafia Online, the ultimate game where strategy, deception, and trust are key. Here, you'll face off against other players from around the world, forming alliances, making bold decisions, and surviving in a game where no one can be trusted.
              Whether you're new to Mafia or a seasoned player, you're in for an unforgettable experience. The Mafia never sleeps, and neither will you as you navigate the dark world of crime and betrayal.
            </p>
            <br />
            <p>
              In Mafia World, you'll engage in thrilling missions, outsmart your opponents, and build your empire. Only the smartest and most ruthless will survive and become the ultimate crime boss. Are you ready to join the Mafia?
            </p>
            <br />
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={styles.input}
            />
            <br />
            <button onClick={handleCreateRoom} className={styles.button}>
              Create Room
            </button>
            <br />
            <input
              type="text"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className={styles.input}
            />
            <br />
            <button onClick={handleJoinRoom} className={styles.button}>
              Join Room
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TitlePage;