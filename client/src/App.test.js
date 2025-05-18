import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./services/socket', () => ({
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  GameStorage: {
    setLastSessionTime: jest.fn(),
    getActiveRoom: jest.fn().mockReturnValue(null),
    setActiveRoom: jest.fn()
  }
}));

test('renders main application header', () => {
  render(<App />);
  const titleElement = screen.getByText(/Mafia Online/i, { selector: '.logo span' });
  expect(titleElement).toBeInTheDocument();
});