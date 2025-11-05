import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/integrations/supabase/client';
import { createNotification } from '@/lib/notifications';

describe('createNotification', () => {
  const rpcMock = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: 'new-id', error: null });

  beforeEach(() => {
    rpcMock.mockClear();
  });

  it('invokes Supabase RPC with expected payload', async () => {
    await createNotification({
      userId: 'target-user',
      type: 'new_comment',
      payload: {
        message: 'Bob commented on your catch',
        catchId: 'catch-1',
        commentId: 'comment-1',
      },
    });

    expect(rpcMock).toHaveBeenCalledWith('create_notification', {
      recipient_id: 'target-user',
      event_type: 'new_comment',
      message: 'Bob commented on your catch',
      catch_target: 'catch-1',
      comment_target: 'comment-1',
      extra_data: null,
    });
  });

  it('serialises extra data when provided', async () => {
    await createNotification({
      userId: 'target-user',
      type: 'new_rating',
      payload: {
        message: 'Rating added',
        catchId: 'catch-2',
        extraData: { rating: 8 },
      },
    });

    expect(rpcMock).toHaveBeenCalledWith('create_notification', expect.objectContaining({
      extra_data: { rating: 8 },
    }));
  });

  it('skips when message missing', async () => {
    await createNotification({
      userId: 'target-user',
      type: 'new_comment',
      payload: { message: '' },
    });

    expect(rpcMock).not.toHaveBeenCalled();
  });
});
