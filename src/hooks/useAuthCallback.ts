import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const useAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.has("code")) {
          currentUrl.searchParams.delete("code");
          currentUrl.searchParams.delete("state");
          window.history.replaceState({}, "", currentUrl.pathname + currentUrl.search + currentUrl.hash);
        }
        navigate("/", { replace: true });
      }

      if (event === "SIGNED_OUT") {
        navigate("/auth", { replace: true });
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, [navigate]);
};
