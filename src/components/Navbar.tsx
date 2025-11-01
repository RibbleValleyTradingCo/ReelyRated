import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Home, PlusCircle, User, LogOut, Layers, FileWarning, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";
import { NotificationsBell } from "@/components/NotificationsBell";
import { isAdminUser } from "@/lib/admin";
import GlobalSearch from "@/components/GlobalSearch";
import LogoMark from "@/components/LogoMark";

export const Navbar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out successfully");
    navigate("/");
  };

  return (
    <nav className="border-b bg-card relative z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
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

          <div className="flex items-center gap-3 flex-1 justify-end md:justify-between">
            <div className="hidden md:flex md:flex-1 md:justify-center">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild className="md:hidden">
                <Link to="/search">
                  <SearchIcon className="w-4 h-4 mr-2" />
                  Search
                </Link>
              </Button>
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
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/admin/reports">
                        <FileWarning className="w-4 h-4 mr-2" />
                        Reports
                      </Link>
                    </Button>
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
        </div>
      </div>
    </nav>
  );
};
