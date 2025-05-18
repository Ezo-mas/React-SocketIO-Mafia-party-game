import React from 'react';
import { render, screen } from '@testing-library/react';
import AboutPage from '../AboutPage';

describe('AboutPage', () => {
  beforeEach(() => {
    render(<AboutPage />);
  });

  test('renders the about page title', () => {
    const titleElement = screen.getByText(/About Us/i);
    expect(titleElement).toBeInTheDocument();
  });

  test('renders the project description', () => {
    const projectDesc = screen.getByText(/Welcome to Mafia World, a thrilling online game/i);
    expect(projectDesc).toBeInTheDocument();
  });

  test('renders about our team section', () => {
    const teamDesc = screen.getByText(/As university students, we've put our skills to the test/i);
    expect(teamDesc).toBeInTheDocument();
  });

  test('renders game description', () => {
    const gameDesc = screen.getByText(/This game is designed for players who enjoy strategy/i);
    expect(gameDesc).toBeInTheDocument();
  });

  test('renders thank you message', () => {
    const thankYouMsg = screen.getByText(/Thank you for your support/i);
    expect(thankYouMsg).toBeInTheDocument();
  });

  test('renders the image', () => {
    const image = document.querySelector('.left img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'hd dpz Whatsapp Instagram Facebook.jpg');
    });

  test('has the correct section structure', () => {
    // Remove the getByRole line and use querySelector directly
    const section = document.querySelector('section.about');
    expect(section).toBeInTheDocument();
    
    const leftDiv = document.querySelector('.left');
    const rightDiv = document.querySelector('.right');
    expect(leftDiv).toBeInTheDocument();
    expect(rightDiv).toBeInTheDocument();
    });
});