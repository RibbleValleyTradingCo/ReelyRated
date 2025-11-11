import { useEffect, useState } from 'react';
import { isAdminUser } from '@/lib/admin';

/**
 * Lightweight hook to check if a user is an admin.
 * Returns false during loading to prevent showing admin UI prematurely.
 *
 * @param userId - The user ID to check
 * @returns boolean indicating if user is admin (false during loading)
 */
export const useIsAdmin = (userId?: string | null): boolean => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const checkAdmin = async () => {
      if (!userId) {
        setIsAdmin(false);
        return;
      }

      const adminStatus = await isAdminUser(userId);

      if (mounted) {
        setIsAdmin(adminStatus);
      }
    };

    void checkAdmin();

    return () => {
      mounted = false;
    };
  }, [userId]);

  return isAdmin;
};
