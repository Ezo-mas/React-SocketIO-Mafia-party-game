import React, { useEffect, useRef } from 'react';
import styles from './LandingPage.module.css';

const LandingPage = () => {
  const textRef = useRef(null);

  // Typewriter effect
  useEffect(() => {
    const texts = [" Mafia", " Jester ", " Doctor", " Detective", " Civilian"];
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

      <section>
        <div className={styles.roles}>
          <div className={styles.title}>
            <span>Who Will You Be?</span>
          </div>
          <div className={styles['roles-details']}>

            <p>
              In the world of Mafia, no one is ever who they seem. Behind every smile could be a killer. Behind every accusation — the truth. Or a lie. 
              Choose your role, or let fate choose for you. Will you protect the innocent, uncover the truth… or silently eliminate your enemies one by one?
              Each role has its own power, purpose, and risk. The game begins. Your role is sealed. Can you survive the night?
            </p>

            <div className={styles['card-container']}>
              <div className={styles.card}>
                <img src="Civilian.png" alt="Card Image" />
                <div className={styles['card-info']}>
                  <div className={styles.title}>No powers. Just instincts, suspicion, and your vote.</div>
                  <div className={styles.title}>Your goal: Work with the Town to find and vote out the Mafia.</div>
                </div>
              </div>
              
              <div className={styles.card}>
                <img src="Detective.png" alt="Card Image" />
                <div className={styles['card-info']}>
                  <div className={styles.title}>You see through the lies — but will they listen before it’s too late?</div>
                  <div className={styles.title}>Your goal: Help the Town identify and eliminate the Mafia.</div>
                  <div className={styles.title}>Your power: Each night, investigate one player to learn their role.</div>
                </div>
              </div>

              <div className={styles.card}>
                <img src="Mafia.png" alt="Card Image" />
                <div className={styles['card-info']}>
                  <div className={styles.title}>Strike in silence. Lie in daylight. Trust no one — not even your allies.</div>
                  <div className={styles.title}>Your goal: Eliminate all Town players.</div>
                  <div className={styles.title}>Your power: Each night, secretly choose one player to kill.</div>
                </div>
              </div>

              <div className={styles.card}>
                <img src="Doctor.png" alt="Card Image" />
                <div className={styles['card-info']}>
                  <div className={styles.title}>One life in your hands. Choose wisely — or let someone die.</div>
                  <div className={styles.title}>Your goal: Protect the Town from the Mafia.</div>
                  <div className={styles.title}>Your power: Each night, pick one player to save from death.</div>
                </div>
              </div>

              <div className={styles.card}>
                <img src="jester.png" alt="Card Image" />
                <div className={styles['card-info']}>
                  <div className={styles.title}>Lies are your game. Getting caught? That’s the win.</div>
                  <div className={styles.title}>Your goal: Get yourself voted out during the day.</div>
                  <div className={styles.title}>Your power: You don’t help the Town or the Mafia — your victory comes from convincing others you’re guilty... even if you're not.</div>
                </div>
              </div> 
            </div>   
          </div>
        </div>
      </section>

      <section>
        <div className={styles.phases}>
          
            <div className={styles.title}>
              <span>The Game Never Sleeps</span>
            </div>  
            <div className={styles['phases-details']}>
              <div className={styles['phases-left']}>
                <div className={styles.left}>
                  <h1>🌙 Night Phase: When the Town Sleeps, Secrets Awaken</h1>
                  <p>As darkness falls, the game shifts. Everyone closes their eyes...</p>
                  <p>Well, almost everyone.</p>
                  <ul> 
                      <li>🕶️ <b>The Mafia wakes up.</b> In secret, they decide who won’t live to see the sunrise. One unlucky player is marked for elimination.</li>
                      <li>🩺 <b>The Doctor stirs.</b> The Doctor picks someone to save.</li>
                      <li>🕵️‍♂️ <b>The Detective investigates.</b> They peek behind the mask of one player, hoping to uncover a Mafia member.</li>
                  </ul>
                  <p>All night actions happen simultaneously, hidden from everyone else. When the town wakes, the consequences are revealed. Did someone die? Was someone saved? Or did the Mafia strike undetected?</p>
                  <br />
                  <br />
                  <br />
                  <h1>☀️ Day Phase: Talk Fast, Think Faster</h1>
                  <p>The sun rises… and tensions rise with it.</p>
                  <ul> 
                      <li>💀 If someone was eliminated overnight, their identity is revealed — but they’re out of the game.</li>
                      <li>🗣️ The survivors debate, accuse, and defend. Everyone has a theory. Everyone’s a suspect.</li>
                      <li>🗳️ A vote is held. The player with the most votes is eliminated — no second chances.</li>
                  </ul>
                  <p>Choose your words carefully. Trust is a weapon — and in this game, everyone’s <b>lying</b>.</p>
                </div>
              </div>     
              <div className={styles['phases-right']}>
                <div className={styles.right}>
                  <img src="abc.jpg" alt="Card Image" />
                </div>                
              </div>
            </div>
          
        </div>
      </section>

      <section>
        <div className={styles.rules}>
          <div className={styles.title}>
            <span>Blood Oaths & Betrayals</span>
          </div>          
            <div className={styles['rules-details']}>
            
              <div className={styles['rules-left']}> 
                <div className={styles.left}>
                  <img src="mafiaparty.jpg" alt="Card Image" />
                </div>
              </div>
              <div className={styles['rules-right']}> 
                <div className={styles.right}>
                  <h1>Trust no one. Obey the rules. Or vanish in the shadows.</h1>
                  <p>To survive in Mafia, you’ve got to know the code. Every player has a role. Every round, someone is lying. The rules are simple — until they’re not.</p>
                  <ul> 
                    <li>Investigate, lie, or tell the truth — just do it convincingly 🕵️‍♂️</li>
                    <li>Mafia eliminates one player each night 💀</li>
                    <li>During the day, everyone votes to eliminate the suspected Mafia ☀️</li>
                    <li>The majority rules. The wrong vote? It could cost you the game 🗳️</li>
                    <li>Dead players stay silent — but they still watch everything unfold... 🤐</li>
                  </ul>
                  <p>Whether you play as an innocent Civilian or a cunning Mafia, play smart, play bold, and never let them see you sweat.</p>
                </div>    
              </div>
              </div>
            
        </div>          
      </section>

      

      

    </div>
  );
};

export default LandingPage;