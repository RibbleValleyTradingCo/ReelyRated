import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Home,
  PlusCircle,
  User,
  LogOut,
  Layers,
  FileWarning,
  Search as SearchIcon,
  Menu,
  X,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/NotificationsBell";
import { isAdminUser } from "@/lib/admin";
import GlobalSearch from "@/components/GlobalSearch";
import LogoMark from "@/components/LogoMark";
import { MobileMenu } from "@/components/MobileMenu";

export const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
    setMobileMenuOpen(false);
  };

  return (
    <nav className="border-b bg-card relative z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 group">
            <LogoMark className="h-10 w-10 transition group-hover:scale-105" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-lg tracking-tight text-foreground group-hover:text-primary transition">
                ReelyRated
              </span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Freshwater Social
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:hidden">
            {user && <NotificationsBell />}
            <Button variant="ghost" size="sm" asChild>
              <Link to="/search">
                <SearchIcon className="w-4 h-4 mr-2" />
                Search
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="ml-1"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          <div className="hidden w-full md:flex md:flex-1 md:items-center md:justify-between md:gap-6">
            <div className="flex flex-1 justify-center max-w-xl">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <NotificationsBell />
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/feed">
                      <Home className="w-4 h-4 mr-2" />
                      Feed
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/sessions">
                      <Layers className="w-4 h-4 mr-2" />
                      Sessions
                    </Link>
                  </Button>
                  {isAdminUser(user.id) && (
                    <>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/admin/reports">
                          <FileWarning className="w-4 h-4 mr-2" />
                          Reports
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to="/admin/audit-log">
                          <ClipboardList className="w-4 h-4 mr-2" />
                          Audit Log
                        </Link>
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/add-catch">
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Catch
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={`/profile/${user.id}`}>
                      <User className="w-4 h-4 mr-2" />
                      Profile
                    </Link>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              ) : (
                <Button variant="ocean" asChild>
                  <Link to="/auth">Sign In</Link>
                </Button>
              )}
            </div>
          </div>

          <MobileMenu
            open={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            user={user ? { id: user.id, isAdmin: isAdminUser(user.id) } : null}
            onSignOut={user ? handleSignOut : undefined}
          />
        </div>
      </div>
    </nav>
  );
};
