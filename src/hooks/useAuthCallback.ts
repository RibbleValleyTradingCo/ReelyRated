import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const useAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const hydrateSession = async () => {
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error("Failed to hydrate Supabase session", error);
      }
    };

    void hydrateSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        const updatedUrl = new URL(window.location.href);
        if (updatedUrl.searchParams.has("code")) {
          updatedUrl.searchParams.delete("code");
          updatedUrl.searchParams.delete("state");
          updatedUrl.searchParams.delete("error");
          window.history.replaceState(
            {},
            "",
            updatedUrl.pathname + updatedUrl.search + updatedUrl.hash,
          );
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
