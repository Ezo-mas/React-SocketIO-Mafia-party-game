import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../LandingPage';

describe('LandingPage', () => {
  test('renders main title', () => {
    render(
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    );
    const titleElement = screen.getByText(/Step into the world of/i);
    expect(titleElement).toBeInTheDocument();

    const mafiaTitle = screen.getByText(/Mafia$/);
    expect(mafiaTitle).toBeInTheDocument();

    const typewriterText = screen.getByText(/I'm a/);
    expect(typewriterText).toBeInTheDocument();

    const detectiveCard = screen.getByAltText(/Detective/);
    expect(detectiveCard).toBeInTheDocument();  
  });

  test('renders all role cards', () => {
    render(
        <BrowserRouter>
        <LandingPage />
        </BrowserRouter>
    );
    
    const civilianCard = screen.getByAltText(/Civilian/);
    const detectiveCard = screen.getByAltText(/Detective/);
    const mafiaCard = screen.getByAltText(/^Mafia$/);
    const doctorCard = screen.getByAltText(/Doctor/);
    const jesterCard = screen.getByAltText(/Jester/);
    
    expect(civilianCard).toBeInTheDocument();
    expect(detectiveCard).toBeInTheDocument();
    expect(mafiaCard).toBeInTheDocument();
    expect(doctorCard).toBeInTheDocument();
    expect(jesterCard).toBeInTheDocument();
    });

    test('renders section headers', () => {
    render(
        <BrowserRouter>
        <LandingPage />
        </BrowserRouter>
    );
    
    const whoWillYouBe = screen.getByText(/Who Will You Be\?/i);
    const gameNeverSleeps = screen.getByText(/The Game Never Sleeps/i);
    const bloodOaths = screen.getByText(/Blood Oaths & Betrayals/i);
    
    expect(whoWillYouBe).toBeInTheDocument();
    expect(gameNeverSleeps).toBeInTheDocument();
    expect(bloodOaths).toBeInTheDocument();
    });

    test('renders game phase descriptions', () => {
    render(
        <BrowserRouter>
        <LandingPage />
        </BrowserRouter>
    );
    
    const nightPhase = screen.getByText(/Night Phase: When the Town Sleeps/i);
    const dayPhase = screen.getByText(/Day Phase: Talk Fast, Think Faster/i);
    
    expect(nightPhase).toBeInTheDocument();
    expect(dayPhase).toBeInTheDocument();
    });

    test('typewriter element initializes correctly', () => {
    render(
        <BrowserRouter>
        <LandingPage />
        </BrowserRouter>
    );
    
    const typewriterContainer = screen.getByText(/I'm a/i);
    expect(typewriterContainer).toBeInTheDocument();
    
    });

    test('loads crucial images', () => {
    render(
        <BrowserRouter>
        <LandingPage />
        </BrowserRouter>
    );
    
    const logo = screen.getByAltText(/Mafia Online Logo/i);
    const phaseImage = screen.getByAltText(/ABC Card/i);
    const rulesImage = screen.getByAltText(/mafiaparty/i);
    
    expect(logo).toBeInTheDocument();
    expect(phaseImage).toBeInTheDocument();
    expect(rulesImage).toBeInTheDocument();
    });
});