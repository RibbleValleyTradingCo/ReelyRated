import { describe, it, expect } from 'vitest';
import { resolveNotificationPath, type NotificationRow } from '@/lib/notifications-utils';

const baseNotification = (overrides: Partial<NotificationRow>): NotificationRow => ({
  id: 'notif-1',
  user_id: 'user-1',
  actor_id: 'actor-1',
  type: 'new_comment',
  data: {},
  is_read: false,
  read_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

describe('resolveNotificationPath', () => {
  it('returns admin reports path for admin notifications', () => {
    const notification = baseNotification({ type: 'admin_report' });
    expect(resolveNotificationPath(notification)).toBe('/admin/reports');
  });

  it('returns catch path when catch_id is present', () => {
    const notification = baseNotification({
      data: { catch_id: 'catch-123' },
    });
    expect(resolveNotificationPath(notification)).toBe('/catch/catch-123');
  });

  it('falls back to actor profile path when no catch id', () => {
    const notification = baseNotification({
      type: 'new_follower',
      data: { actor_username: 'angler_jane' },
    });
    expect(resolveNotificationPath(notification)).toBe('/profile/angler_jane');
  });
});
