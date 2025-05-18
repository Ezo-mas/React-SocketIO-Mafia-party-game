import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Join from '../Join';
import { LobbyContext } from '../../context/LobbyContext';
import socket from '../../services/socket';

// Mock socket.io-client
jest.mock('../../services/socket', () => ({
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  leaveGame: jest.fn(),
  GameStorage: {
    getActiveRoom: jest.fn().mockReturnValue(null),
    setActiveRoom: jest.fn()
  }
}));

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ 
    state: { username: 'TestUser', comingFromGame: false } 
  })
}));

const mockAddPlayer = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

// Test wrapper to provide context
const renderWithContext = (ui) => {
  return render(
    <LobbyContext.Provider value={{ addPlayer: mockAddPlayer }}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </LobbyContext.Provider>
  );
};

describe('Join Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders join page with title and form elements', () => {
    renderWithContext(<Join />);
    
    // Check page title
    const titleElement = screen.getByText(/Join a City/i);
    expect(titleElement).toBeInTheDocument();
    
    // Check form elements
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    const roomInput = screen.getByPlaceholderText(/Enter room code/i);
    const joinButton = screen.getByText(/Join Room/i);
    
    expect(nameInput).toBeInTheDocument();
    expect(roomInput).toBeInTheDocument();
    expect(joinButton).toBeInTheDocument();
  });

  test('displays how to join instructions', () => {
    renderWithContext(<Join />);
    
    const howToJoin = screen.getByText(/How to Join:/i);
    expect(howToJoin).toBeInTheDocument();
    
    const instructionItems = screen.getAllByRole('listitem');
    expect(instructionItems.length).toBe(3); // Should have 3 instruction items
  });

  test('allows input of name and room ID', () => {
    renderWithContext(<Join />);
    
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    const roomInput = screen.getByPlaceholderText(/Enter room code/i);
    
    fireEvent.change(nameInput, { target: { value: 'Player1' } });
    fireEvent.change(roomInput, { target: { value: 'ROOM123' } });
    
    expect(nameInput.value).toBe('Player1');
    expect(roomInput.value).toBe('ROOM123');
  });

  test('validates form and prevents submission with empty fields', () => {
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    renderWithContext(<Join />);
    
    // Clear the pre-filled name from mocked location state
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    fireEvent.change(nameInput, { target: { value: '' } });
    
    const joinButton = screen.getByText(/Join Room/i);
    fireEvent.click(joinButton);
    
    expect(alertMock).toHaveBeenCalledWith('Please enter your name.');
    expect(socket.emit).not.toHaveBeenCalled();
    
    alertMock.mockRestore();
  });

  test('emits join_room event when form is submitted with valid data', () => {
    renderWithContext(<Join />);
    
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    const roomInput = screen.getByPlaceholderText(/Enter room code/i);
    const joinButton = screen.getByText(/Join Room/i);
    
    fireEvent.change(nameInput, { target: { value: 'Player1' } });
    fireEvent.change(roomInput, { target: { value: 'ROOM123' } });
    fireEvent.click(joinButton);
    
    expect(socket.emit).toHaveBeenCalledWith('leave_any_previous_games');
    expect(socket.emit).toHaveBeenCalledWith('join_room', 'ROOM123', 'Player1', false);
    expect(mockAddPlayer).toHaveBeenCalledWith('Player1');
  });

 test('displays room locked error when received from socket', async () => {
  renderWithContext(<Join />);
  
  // Find the callback registered for room_locked_error
  const roomLockedErrorCallback = socket.on.mock.calls.find(
    call => call[0] === 'room_locked_error'
  )[1];
  
  // Trigger the error inside act() wrapper
  await act(async () => {
    roomLockedErrorCallback('LOCKED123');
  });
  
  // Check that error message appears
  const errorMessage = screen.getByText(/Room LOCKED123 is locked and cannot be joined/i);
  expect(errorMessage).toBeInTheDocument();
  
  // Then test that it disappears after 5 seconds
  await act(async () => {
    // Fast-forward time to trigger the setTimeout
    jest.advanceTimersByTime(5000);
  });
  
  // Verify error message is gone after timeout
  expect(screen.queryByText(/Room LOCKED123 is locked and cannot be joined/i)).not.toBeInTheDocument();
});

test('displays name editor button when coming from game', () => {
  // Create a custom implementation for this specific test
  const useLocationMock = jest.spyOn(require('react-router-dom'), 'useLocation');
  useLocationMock.mockReturnValue({ 
      state: { username: 'ReturnPlayer', comingFromGame: true } 
  });
  
  renderWithContext(<Join />);
  
  // Look for "Change" button that appears for returning players
  const changeButton = screen.getByText('Change');
  expect(changeButton).toBeInTheDocument();
  
  // Clean up mock to not affect other tests
  useLocationMock.mockRestore();
  });
});