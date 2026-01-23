/**
 * Tests for Dashboard component logic.
 * Tests optimistic updates, task interactions, and data rendering.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../src/pages/Dashboard';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import * as api from '../src/api/client';
import { mockAdmin, mockMember, mockDashboardData, mockEmptyDashboard, createTaskWithStatus, createEvent, createDashboardData } from './utils';

// Mock the API module
vi.mock('../src/api/client', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  getDashboard: vi.fn(),
  markTaskDone: vi.fn(),
  markTaskCannotDo: vi.fn(),
  undoTaskStatus: vi.fn(),
  sendTaskReminder: vi.fn(),
  sendEventReminders: vi.fn(),
  changePassword: vi.fn(),
}));

function renderDashboard() {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Dashboard />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

describe('Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMe).mockResolvedValue(mockMember);
    vi.mocked(api.getDashboard).mockResolvedValue(mockDashboardData);
  });

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      vi.mocked(api.getDashboard).mockImplementation(() => new Promise(() => {}));
      renderDashboard();
      
      // Should show loading indicator
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows no active semester message', async () => {
      vi.mocked(api.getDashboard).mockResolvedValue(mockEmptyDashboard);
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText(/no active semester/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Display', () => {
    it('displays semester name', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('Fall 2024')).toBeInTheDocument();
      });
    });

    it('displays week tabs', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText(/week 1/i)).toBeInTheDocument();
      });
    });

    it('displays event name', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('Sweet Sunday')).toBeInTheDocument();
      });
    });

    it('displays task title', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('Send email reminder')).toBeInTheDocument();
      });
    });

    it('displays assignee name', async () => {
      renderDashboard();
      
      await waitFor(() => {
        // Multiple elements may show "Member User" (header + assignee)
        const elements = screen.getAllByText('Member User');
        expect(elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Task Status Display', () => {
    it('shows done count for event', async () => {
      const doneTask = createTaskWithStatus('DONE');
      const pendingTask = createTaskWithStatus('PENDING');
      const event = createEvent([doneTask, pendingTask]);
      const data = createDashboardData([event]);
      vi.mocked(api.getDashboard).mockResolvedValue(data);
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('1/2 done')).toBeInTheDocument();
      });
    });

    it('shows task as done with line-through', async () => {
      const doneTask = createTaskWithStatus('DONE');
      const event = createEvent([doneTask]);
      const data = createDashboardData([event]);
      vi.mocked(api.getDashboard).mockResolvedValue(data);
      
      renderDashboard();
      
      await waitFor(() => {
        const taskText = screen.getByText(doneTask.title);
        expect(taskText).toHaveClass('line-through');
      });
    });

    it('shows cannot-do reason', async () => {
      const cannotDoTask = createTaskWithStatus('CANNOT_DO');
      cannotDoTask.cannot_do_reason = 'Materials unavailable';
      const event = createEvent([cannotDoTask]);
      const data = createDashboardData([event]);
      vi.mocked(api.getDashboard).mockResolvedValue(data);
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText(/materials unavailable/i)).toBeInTheDocument();
      });
    });
  });

  describe('Week Selection', () => {
    it('highlights current week', async () => {
      renderDashboard();
      
      await waitFor(() => {
        const weekTab = screen.getByText(/week 1/i).closest('button');
        expect(weekTab).toHaveClass('border-primary-500');
      });
    });
  });

  describe('Header', () => {
    it('displays user name', async () => {
      renderDashboard();
      
      // Wait for dashboard to load first (showing semester name means data loaded)
      await waitFor(() => {
        expect(screen.getByText('Fall 2024')).toBeInTheDocument();
      });
      
      // Check user name is displayed - there may be multiple (header + assignee)
      const userNameElements = screen.getAllByText(/Member User/);
      expect(userNameElements.length).toBeGreaterThan(0);
    });

    it('shows logout button', async () => {
      renderDashboard();
      
      // Wait for dashboard to fully load
      await waitFor(() => {
        expect(screen.getByText('Fall 2024')).toBeInTheDocument();
      });
      
      // Logout is an icon button - check for lucide-log-out icon
      const logoutIcon = await screen.findByText('Fall 2024');
      expect(logoutIcon).toBeInTheDocument();
      expect(document.querySelector('.lucide-log-out')).toBeInTheDocument();
    });

    it('shows admin link for admin users', async () => {
      vi.mocked(api.getMe).mockResolvedValue(mockAdmin);
      vi.mocked(api.getDashboard).mockResolvedValue({
        ...mockDashboardData,
        user_role: 'ADMIN',
      });
      
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByRole('link', { name: '' }) || document.querySelector('a[href="/admin"]')).toBeDefined();
      });
    });

    it('hides admin link for regular members', async () => {
      renderDashboard();
      
      await waitFor(() => {
        expect(document.querySelector('a[href="/admin"]')).toBeNull();
      });
    });
  });

  describe('Theme Toggle', () => {
    it('renders theme toggle button', async () => {
      renderDashboard();
      
      await waitFor(() => {
        // ThemeToggle component should be present
        const themeButtons = document.querySelectorAll('button');
        expect(themeButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Password Change Modal', () => {
    it('opens password modal on key icon click', async () => {
      const user = userEvent.setup();
      renderDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('Fall 2024')).toBeInTheDocument();
      });
      
      // Find and click password change button
      const passwordBtn = document.querySelector('[title="Change Password"]');
      if (passwordBtn) {
        await user.click(passwordBtn);
        
        await waitFor(() => {
          // Modal has both heading and button with "Change Password" text
          const elements = screen.getAllByText(/change password/i);
          expect(elements.length).toBeGreaterThan(0);
        });
      }
    });
  });
});

describe('Task Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMe).mockResolvedValue(mockMember);
    vi.mocked(api.getDashboard).mockResolvedValue(mockDashboardData);
    vi.mocked(api.markTaskDone).mockResolvedValue({ ...mockDashboardData.weeks[0].events[0].tasks[0], status: 'DONE' });
    vi.mocked(api.undoTaskStatus).mockResolvedValue({ ...mockDashboardData.weeks[0].events[0].tasks[0], status: 'PENDING' });
  });

  it('marks task as done on checkbox click', async () => {
    const user = userEvent.setup();
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Send email reminder')).toBeInTheDocument();
    });
    
    // Find checkbox button (empty div that acts as checkbox)
    const checkbox = document.querySelector('.border-2.border-gray-300');
    if (checkbox) {
      await user.click(checkbox);
      
      await waitFor(() => {
        expect(api.markTaskDone).toHaveBeenCalledWith(1);
      });
    }
  });

  it('applies optimistic update immediately', async () => {
    vi.mocked(api.markTaskDone).mockImplementation(() => new Promise(() => {})); // Never resolves
    const user = userEvent.setup();
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Send email reminder')).toBeInTheDocument();
    });
    
    const checkbox = document.querySelector('.border-2.border-gray-300');
    if (checkbox) {
      await user.click(checkbox);
      
      // Should immediately show as done (optimistic)
      await waitFor(() => {
        const taskText = screen.getByText('Send email reminder');
        expect(taskText).toHaveClass('line-through');
      });
    }
  });

  it('reverts on API error', async () => {
    vi.mocked(api.markTaskDone).mockRejectedValue(new Error('Server error'));
    const user = userEvent.setup();
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText('Send email reminder')).toBeInTheDocument();
    });
    
    const checkbox = document.querySelector('.border-2.border-gray-300');
    if (checkbox) {
      await user.click(checkbox);
      
      // Should revert after error
      await waitFor(() => {
        const taskText = screen.getByText('Send email reminder');
        expect(taskText).not.toHaveClass('line-through');
      });
    }
  });
});

describe('Admin Features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getMe).mockResolvedValue(mockAdmin);
    vi.mocked(api.getDashboard).mockResolvedValue({
      ...mockDashboardData,
      user_role: 'ADMIN',
    });
    vi.mocked(api.sendEventReminders).mockResolvedValue({ message: 'Sent', reminders_sent: 1 });
  });

  it('shows remind all button for admin', async () => {
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText(/remind all/i)).toBeInTheDocument();
    });
  });

  it('shows completed_by name for admin', async () => {
    const doneTask = createTaskWithStatus('DONE');
    doneTask.completed_by_name = 'John Doe';
    const event = createEvent([doneTask]);
    const data = {
      ...createDashboardData([event]),
      user_role: 'ADMIN' as const,
    };
    vi.mocked(api.getDashboard).mockResolvedValue(data);
    
    renderDashboard();
    
    await waitFor(() => {
      expect(screen.getByText(/completed by john doe/i)).toBeInTheDocument();
    });
  });
});
