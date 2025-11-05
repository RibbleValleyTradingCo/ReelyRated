import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotificationsBell } from '@/components/NotificationsBell';
import type { NotificationRow } from '@/components/notifications/NotificationListItem';

const createNotification = (overrides: Partial<NotificationRow> = {}): NotificationRow => ({
  id: 'notif-1',
  user_id: 'user-1',
  actor_id: 'actor-2',
  type: 'new_comment',
  data: { catch_id: 'catch-123', message: 'Alice commented on your catch.' },
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

const markOneMock = vi.fn();
const markAllMock = vi.fn();
const clearAllMock = vi.fn();
const refreshMock = vi.fn();
const setNotificationsMock = vi.fn();

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    notifications: [createNotification()],
    setNotifications: setNotificationsMock,
    loading: false,
    refresh: refreshMock,
    markOne: markOneMock,
    markAll: markAllMock,
    clearAll: clearAllMock,
  }),
}));

const removeChannelMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: removeChannelMock,
  },
}));

describe('NotificationsBell', () => {
  beforeEach(() => {
    markOneMock.mockClear();
    markAllMock.mockClear();
    clearAllMock.mockClear();
    refreshMock.mockClear();
    setNotificationsMock.mockClear();
    removeChannelMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('triggers mark all read and clear all actions', async () => {
    const user = userEvent.setup();
    render(<NotificationsBell />);

    const bellButton = screen.getByRole('button', { name: /open notifications/i });
    await user.click(bellButton);

    const markAllButton = screen.getByRole('button', { name: /mark all read/i });
    await user.click(markAllButton);
    expect(markAllMock).toHaveBeenCalled();

    const clearAllButton = screen.getByRole('button', { name: /clear all/i });
    await user.click(clearAllButton);
    expect(clearAllMock).toHaveBeenCalled();
  });

  it('marks a single notification as read', async () => {
    const user = userEvent.setup();
    render(<NotificationsBell />);

    const bellButton = screen.getByRole('button', { name: /open notifications/i });
    await user.click(bellButton);

    const markReadButton = screen.getByRole('button', { name: /mark read/i });
    await user.click(markReadButton);
    expect(markOneMock).toHaveBeenCalled();
  });
});
