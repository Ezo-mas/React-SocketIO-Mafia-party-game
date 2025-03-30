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
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;