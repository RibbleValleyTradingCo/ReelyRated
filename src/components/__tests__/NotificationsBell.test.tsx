import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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

const { removeChannelMock, channelMock } = vi.hoisted(() => {
  const removeChannelMock = vi.fn();
  const channelMock = vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  }));
  return { removeChannelMock, channelMock };
});

const notificationListItemMock = vi.hoisted(() => ({
  lastProps: {
    notification: null as NotificationRow | null,
    onMarkRead: undefined as ((notification: NotificationRow) => void) | undefined,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
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

vi.mock('@/components/notifications/NotificationListItem', () => ({
  NotificationListItem: (props: {
    notification: NotificationRow;
    onView: (notification: NotificationRow) => void;
    onMarkRead: (notification: NotificationRow) => void;
  }) => {
    notificationListItemMock.lastProps.notification = props.notification;
    notificationListItemMock.lastProps.onMarkRead = props.onMarkRead;
    return <div data-testid="notification-item" />;
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: channelMock,
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
    channelMock.mockClear();
    notificationListItemMock.lastProps.notification = null;
    notificationListItemMock.lastProps.onMarkRead = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <NotificationsBell />
      </MemoryRouter>,
    );

  it('triggers mark all read and clear all actions', async () => {
    const user = userEvent.setup();
    renderComponent();

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
    renderComponent();

    const bellButton = screen.getByRole('button', { name: /open notifications/i });
    await user.click(bellButton);

    await waitFor(() => {
      expect(notificationListItemMock.lastProps.onMarkRead).toBeDefined();
      expect(notificationListItemMock.lastProps.notification).not.toBeNull();
    });

    notificationListItemMock.lastProps.onMarkRead?.(
      notificationListItemMock.lastProps.notification as NotificationRow,
    );

    expect(markOneMock).toHaveBeenCalled();
  });
});
