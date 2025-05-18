import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Create from '../Create';
import { LobbyContext } from '../../context/LobbyContext';
import socket from '../../services/socket';

// Mock uuid generation
jest.mock('uuid', () => {
  return {
    v4: () => '12345678-mock-uuid-longer-string'
  };
});

// Mock socket.io-client
jest.mock('../../services/socket', () => ({
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  leaveGame: jest.fn(),
  GameStorage: {
    getActiveRoom: jest.fn().mockReturnValue(null),
    setActiveRoom: jest.fn(),
    setCreatingRoom: jest.fn(),
    clearCreatingRoom: jest.fn()
  }
}));

// Mock react-router-dom hooks
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

const mockAddPlayer = jest.fn();
const mockSetRoomHost = jest.fn();

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
    <LobbyContext.Provider value={{ addPlayer: mockAddPlayer, setRoomHost: mockSetRoomHost }}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </LobbyContext.Provider>
  );
};

describe('Create Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders create page with title and form elements', () => {
    renderWithContext(<Create />);
    
    // Check page title
    const titleElement = screen.getByText(/Create a City/i);
    expect(titleElement).toBeInTheDocument();
    
    // Check form elements
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    const createButton = screen.getByRole('button', { name: /Create Room/i });
    
    expect(nameInput).toBeInTheDocument();
    expect(createButton).toBeInTheDocument();
  });

  test('displays instructions for creating a city', () => {
    renderWithContext(<Create />);
    
    const howToCreate = screen.getByText(/How to Create Your City:/i);
    expect(howToCreate).toBeInTheDocument();
    
    const instructionItems = screen.getAllByRole('listitem');
    expect(instructionItems.length).toBe(4); // Should have 4 instruction items
  });

  test('allows input of host name', () => {
    renderWithContext(<Create />);
    
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    
    fireEvent.change(nameInput, { target: { value: 'GameHost' } });
    
    expect(nameInput.value).toBe('GameHost');
  });

  test('validates form and prevents submission with empty host name', () => {
    const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
    renderWithContext(<Create />);
    
    const createButton = screen.getByRole('button', { name: /Create Room/i });
    fireEvent.click(createButton);
    
    expect(alertMock).toHaveBeenCalledWith('Please enter your name.');
    expect(socket.emit).not.toHaveBeenCalled();
    
    alertMock.mockRestore();
  });

  test('emits events and sets up new room when form is submitted with valid data', () => {
    renderWithContext(<Create />);
    
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    const createButton = screen.getByRole('button', { name: /Create Room/i });
    
    fireEvent.change(nameInput, { target: { value: 'GameHost' } });
    fireEvent.click(createButton);
    
    // Check socket events
    expect(socket.emit).toHaveBeenCalledWith('leave_any_previous_games');
    expect(socket.emit).toHaveBeenCalledTimes(3);
    expect(socket.emit.mock.calls[1][0]).toBe('navigation_intent');
    expect(socket.emit.mock.calls[2][0]).toBe('join_room');
    expect(socket.emit.mock.calls[2][2]).toBe('GameHost');
    expect(socket.emit.mock.calls[2][3]).toBe(true);
    
    // Check context updates
    expect(mockAddPlayer).toHaveBeenCalledWith('GameHost');
    expect(mockSetRoomHost).toHaveBeenCalledWith('GameHost');
    
    // Check storage updates
    expect(socket.GameStorage.setCreatingRoom).toHaveBeenCalled();
  });

  test('displays room locked error when received from socket', async () => {
    renderWithContext(<Create />);
    
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

  test('navigates to lobby on successful room creation', () => {
    
    // Capture the callback function for join_room_success
    let joinRoomSuccessCallback;
    socket.on.mockImplementation((event, callback) => {
      if (event === 'join_room_success') {
        joinRoomSuccessCallback = callback;
      }
    });
    
    renderWithContext(<Create />);
    
    // Enter a name to set the hostName state
    const nameInput = screen.getByPlaceholderText(/Enter your name/i);
    fireEvent.change(nameInput, { target: { value: 'GameHost' } });
    
    // Simulate receiving a join_room_success event
    joinRoomSuccessCallback('NEW_ROOM_123');
    
    expect(mockNavigate).toHaveBeenCalledWith(
        '/lobby/NEW_ROOM_123', 
        expect.objectContaining({ 
        state: expect.objectContaining({
            username: 'GameHost',
            isHost: true
        })
      })
    );
  });
});