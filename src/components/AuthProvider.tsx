import { useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthContext } from "@/components/AuthContext";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const syncSession = (nextSession: Session | null) => {
      if (!mounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const clearStaleSession = () => {
      console.warn("[Auth] Clearing stale session data");
      localStorage.removeItem("supabase.auth.token");
      sessionStorage.clear();
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("sb-")) {
          localStorage.removeItem(key);
        }
      });
    };

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("[Auth] Error getting session:", error);
        // If there's an error getting the session, clear potentially stale data
        clearStaleSession();
        syncSession(null);
      } else {
        syncSession(session);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.log("[Auth] Auth state changed:", event);

      // If we get a SIGNED_OUT event but still have session data, clear it
      if (event === "SIGNED_OUT" && !nextSession) {
        clearStaleSession();
      }

      syncSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
