import React, { useEffect, useRef } from 'react';
import styles from './LandingPage.module.css';

const LandingPage = () => {
  const textRef = useRef(null);

  // Typewriter effect
  useEffect(() => {
    const texts = [" Mafia", " Police Officer", " Doctor", " Detective", " Civilian"];
    let index = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId = null;

    const typeWriter = () => {
      if (!textRef.current) return;

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

      timeoutId = setTimeout(typeWriter, isDeleting ? 50 : 100);
    };

    typeWriter();
    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <div style={{ backgroundColor: 'black', minHeight: '100vh' }}>
      <section>
        <div className={styles['main-container']}>
          <div className={styles.image}>
            <img src="Nameless_.jpg" alt="Mafia Online Logo" />
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
              Welcome to Mafia Online, the ultimate game where strategy, deception, and trust are key. 
              Here, you'll face off against other players from around the world, forming alliances, 
              making bold decisions, and surviving in a game where no one can be trusted.
              Whether you're new to Mafia or a seasoned player, you're in for an unforgettable experience. 
              The Mafia never sleeps, and neither will you as you navigate the dark world of crime and betrayal.
            </p>

            <br />

            <p>
              In Mafia World, you'll engage in thrilling missions, outsmart your opponents, and build your empire. 
              Only the smartest and most ruthless will survive and become the ultimate crime boss. 
              Are you ready to join the Mafia?
            </p>

            <h1> <span>Rules</span> of the game</h1>
            <p>
            <h2><b>Roles & Their Abilities:</b></h2>
            <b>Town Side</b>
            <br />
            <ol>
                <li>Villager (Townsperson) - A regular player with no special abilities. Their role is to discuss, vote, and identify Mafia members.</li>
                <li>Doctor - Can choose one player each night to protect from elimination. Cannot save the same person two nights in a row.</li>
                <li>Detective (Sheriff) - Can investigate one player per night to learn if they are Mafia or not.</li>
                </ol>
            <b>Mafia Side</b>
            <br />
            <ol>
                <li>Mafia Member - Works with the other Mafia members to eliminate one Town player each night.</li>
            </ol>
            </p>
            <p>
            <br />
              <h2><b> Game Phases:</b></h2>
              <b> Night Phase</b>
              <br />
              <ul>
                <li>The Mafia secretly selects one player to eliminate.</li>
                <li>Doctor picks someone to save.</li>
                <li>The Detective investigates one player to determine their alignment.</li>
                <li>All actions occur simultaneously and are processed by the system.</li>
              </ul>
              <b>Day Phase</b>
              <br />
              <ul>
                <li>It is revealed whether a player was eliminated during the night.</li>
                <li>Players discuss, debate, and accuse each other.</li>
                <li>A vote is held, and the player with the most votes is eliminated.</li>
                <li>Tie? No one goes. But the paranoia grows.</li>
              </ul>
              <b> Repeat Until Victory</b>
              <ul>
                <li>The Town wins if all Mafia members are eliminated.</li>
                <li>The Mafia wins if they equal or outnumber the Town.</li>
              </ul>
              <br />
              <br />
              <h2><b> Voting Rules:</b></h2>
              <ul>
                <li>Voting takes place during the Day Phase.</li>
                <li>Call someone out. Defend yourself. Play the room.</li>
                <li>The player with the most votes is eliminated from the game.</li>
                <li>If a tie occurs, the round proceeds without elimination.</li>
              </ul>
              <br /> 
              <br />
              <h2><b>Most important rule:</b></h2>
              No Role Reveals After Death – Dead men tell no tales. If you’re eliminated, you’re silent.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;