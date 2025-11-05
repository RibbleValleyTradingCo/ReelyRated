import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, Menu, Search as SearchIcon, X } from "lucide-react";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/NotificationsBell";
import { isAdminUser } from "@/lib/admin";
import LogoMark from "@/components/LogoMark";
import { MobileMenu, MOBILE_MENU_ID } from "@/components/MobileMenu";

export const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const isOnSearchRoute = location.pathname.startsWith("/search");

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
    setMenuOpen(false);
  };

  const handleSearchToggle = () => {
    if (isOnSearchRoute) {
      navigate(-1);
    } else {
      navigate("/search");
    }
  };

  return (
    <nav className="relative z-20 border-b border-border/70 bg-card">
      <div className="container mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-start overflow-visible">
          {user ? (
            <NotificationsBell />
          ) : (
            <Button asChild variant="ocean" size="sm" className="px-4 py-2">
              <Link to="/auth#signup">Sign Up</Link>
            </Button>
          )}
        </div>

        <Link to="/" className="flex flex-col items-center gap-1 text-center">
          <LogoMark className="h-12 w-12 transition hover:scale-105" />
          <span className="text-base font-semibold tracking-tight text-foreground">ReelyRated</span>
          <span className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Freshwater Social</span>
        </Link>

        <div className="flex items-center justify-end gap-2 overflow-visible">
          {user ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label={isOnSearchRoute ? "Close search" : "Open search"}
                onClick={handleSearchToggle}
              >
                {isOnSearchRoute ? <X className="h-5 w-5" /> : <SearchIcon className="h-5 w-5" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-controls={MOBILE_MENU_ID}
                aria-expanded={menuOpen}
                aria-haspopup="true"
                aria-label="Toggle navigation menu"
                onClick={() => setMenuOpen((prev) => !prev)}
              >
                {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <Link to="/auth" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Log In
            </Link>
          )}
        </div>
      </div>

      {user ? (
        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={{ id: user.id, isAdmin: isAdminUser(user.id) }}
          onSignOut={handleSignOut}
        />
      ) : null}
    </nav>
  );
};

export default Navbar;
