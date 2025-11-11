import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/AuthProvider';
import { isAdminUser } from '@/lib/admin';
import { toast } from 'sonner';

/**
 * Custom hook for admin authentication and authorization.
 * Properly handles async admin status checks and redirects non-admin users.
 *
 * @param redirectPath - Path to redirect to if user is not admin (default: '/feed')
 * @returns Object containing isAdmin status and loading state
 */
export const useAdminAuth = (redirectPath = '/feed') => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;

      if (!user) {
        setChecking(false);
        toast.error("Authentication required");
        navigate('/auth');
        return;
      }

      const adminStatus = await isAdminUser(user.id);
      setIsAdmin(adminStatus);
      setChecking(false);

      if (!adminStatus) {
        toast.error("Admin access required");
        navigate(redirectPath);
      }
    };

    void checkAdmin();
  }, [authLoading, user, navigate, redirectPath]);

  return { isAdmin, loading: checking || authLoading };
};
