/**
 * Tests for AuthContext.tsx
 * Tests authentication state management and session persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import * as api from '../src/api/client';
import { mockAdmin, mockMember } from './utils';

// Mock the API module
vi.mock('../src/api/client', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
}));

// Test component that uses AuthContext
function TestComponent() {
  const { user, loading, login, logout } = useAuth();
  
  if (loading) return <div data-testid="loading">Loading...</div>;
  
  const handleLogin = async () => {
    try {
      await login('admin', 'pass');
    } catch {
      // Error handled by component - login failed
    }
  };
  
  return (
    <div>
      {user ? (
        <>
          <div data-testid="user-info">{user.display_name}</div>
          <div data-testid="user-role">{user.role}</div>
          <button onClick={logout} data-testid="logout-btn">Logout</button>
        </>
      ) : (
        <button onClick={handleLogin} data-testid="login-btn">Login</button>
      )}
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Initial State', () => {
    it('starts with loading true', () => {
      vi.mocked(api.getMe).mockImplementation(() => new Promise(() => {})); // Never resolves
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('checks session on mount via getMe', async () => {
      vi.mocked(api.getMe).mockRejectedValue(new Error('Not authenticated'));
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(api.getMe).toHaveBeenCalledTimes(1);
      });
    });

    it('sets user if session exists', async () => {
      vi.mocked(api.getMe).mockResolvedValue(mockAdmin);
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user-info')).toHaveTextContent('Admin User');
      });
    });

    it('shows login button if no session', async () => {
      vi.mocked(api.getMe).mockRejectedValue(new Error('Not authenticated'));
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
    });
  });

  describe('Login', () => {
    it('calls api.login and sets user on success', async () => {
      vi.mocked(api.getMe).mockRejectedValue(new Error('Not authenticated'));
      vi.mocked(api.login).mockResolvedValue(mockAdmin);
      
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('login-btn'));
      
      await waitFor(() => {
        expect(api.login).toHaveBeenCalledWith('admin', 'pass');
        expect(screen.getByTestId('user-info')).toHaveTextContent('Admin User');
      });
    });

    it('handles login error', async () => {
      vi.mocked(api.getMe).mockRejectedValue(new Error('Not authenticated'));
      vi.mocked(api.login).mockRejectedValue(new Error('Invalid credentials'));
      
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('login-btn'));
      
      // Should still show login button after failed login
      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
    });
  });

  describe('Logout', () => {
    it('calls api.logout and clears user', async () => {
      vi.mocked(api.getMe).mockResolvedValue(mockAdmin);
      vi.mocked(api.logout).mockResolvedValue(undefined);
      
      const user = userEvent.setup();
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user-info')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('logout-btn'));
      
      await waitFor(() => {
        expect(api.logout).toHaveBeenCalled();
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
    });
  });

  describe('User Roles', () => {
    it('correctly identifies admin users', async () => {
      vi.mocked(api.getMe).mockResolvedValue(mockAdmin);
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('ADMIN');
      });
    });

    it('correctly identifies member users', async () => {
      vi.mocked(api.getMe).mockResolvedValue(mockMember);
      
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('user-role')).toHaveTextContent('MEMBER');
      });
    });
  });
});
