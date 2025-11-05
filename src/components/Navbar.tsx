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
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const isOnSearchRoute = location.pathname.startsWith("/search");

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setProfileUsername(null);
      return () => {
        active = false;
      };
    }

    supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error("Failed to load profile username", error);
        }
        setProfileUsername(data?.username ?? user.user_metadata?.username ?? null);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

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

  const renderAuthIcons = () => (
    <div className="flex items-center gap-2 overflow-visible">
      <Button
        variant="ghost"
        size="icon"
        aria-label={isOnSearchRoute ? "Close search" : "Open search"}
        onClick={handleSearchToggle}
      >
        {isOnSearchRoute ? <X className="h-5 w-5" /> : <SearchIcon className="h-5 w-5" />}
      </Button>
      <NotificationsBell />
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
    </div>
  );

  const renderGuestActions = () => (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        aria-label={isOnSearchRoute ? "Close search" : "Open search"}
        onClick={handleSearchToggle}
      >
        {isOnSearchRoute ? <X className="h-5 w-5" /> : <SearchIcon className="h-5 w-5" />}
      </Button>
      <Button asChild variant="ocean" size="sm" className="px-4 py-2">
        <Link to="/auth#signup">Sign Up</Link>
      </Button>
      <Link
        to="/auth"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Log In
      </Link>
    </div>
  );

  return (
    <nav className="relative z-20 border-b border-border/70 bg-card">
      <div className="container mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <LogoMark className="h-12 w-12 transition hover:scale-105" />
          <div className="leading-tight">
            <span className="block text-base font-semibold tracking-tight text-foreground">
              ReelyRated
            </span>
            <span className="block text-[11px] uppercase tracking-[0.3em] text-muted-foreground">
              Freshwater Social
            </span>
          </div>
        </Link>

        {user ? renderAuthIcons() : renderGuestActions()}
      </div>

      {user ? (
        <MobileMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          user={{ id: user.id, username: profileUsername ?? user.user_metadata?.username ?? null, isAdmin: isAdminUser(user.id) }}
          onSignOut={handleSignOut}
        />
      ) : null}
    </nav>
  );
};

export default Navbar;
