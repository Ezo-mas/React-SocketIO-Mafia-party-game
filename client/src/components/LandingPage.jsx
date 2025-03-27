import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  
  const handlePlayClick = () => {
    navigate('/title');
  };

  return (
    <section className="how-to-play">
      <div className="container">
        <h2>Mafia Game</h2>
        <div className="image">
          <img src="OHedN0iv.jpg" alt="Mafia Game Logo" />
        </div>
        <div className="description">
          <p>
            Mafia is a social deduction game where players are divided into two teams: the Mafia and the Townspeople. 
            The Mafia's goal is to eliminate all the Townspeople, while the Townspeople aim to uncover and 
            eliminate all the Mafia members. The game alternates between day and night phases. During the day, 
            players discuss and vote on who they suspect to be a Mafia member. At night, the Mafia secretly chooses a 
            Townsperson to eliminate.
          </p>
        </div>
        <div className="play-now">
          <button onClick={handlePlayClick} className="play-button">
            Play Now
          </button>
        </div>
      </div>
    </section>
  );
};

export default LandingPage;