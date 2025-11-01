import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Layers, PlusCircle } from "lucide-react";
import { format } from "date-fns";

interface SessionRow {
  id: string;
  title: string;
  venue: string | null;
  date: string | null;
  notes: string | null;
  created_at: string;
  catches: { count: number }[];
}

export const Sessions = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) return;
      setIsLoading(true);
      const { data, error } = await supabase
        .from("sessions")
        .select("id, title, venue, date, notes, created_at, catches:catches_session_id_fkey(count)")
        .eq("user_id", user.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSessions(data as unknown as SessionRow[]);
      }
      setIsLoading(false);
    };

    if (user) {
      void fetchSessions();
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Fishing Sessions</h1>
            <p className="text-sm text-muted-foreground">
              Group your catches by trip to spot patterns across venues and seasons.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate("/feed")}>Back to feed</Button>
            <Button onClick={() => navigate("/add-catch")}
              className="flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Log a catch
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Loading sessions…
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Layers className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
              <p className="text-muted-foreground">
                No sessions yet. Log a catch and create a new session to get started.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sessions.map((session) => {
              const catchesCount = session.catches?.[0]?.count ?? 0;
              const formattedDate = session.date
                ? format(new Date(session.date), "dd MMM yyyy")
                : "Date unknown";
              return (
                <Card key={session.id} className="border-border/60 bg-card/80 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold text-foreground">
                      {session.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formattedDate}
                      </span>
                      {session.venue && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {session.venue}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {catchesCount} catch{catchesCount === 1 ? "" : "es"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {session.notes ? (
                      <p className="text-sm text-muted-foreground line-clamp-3">{session.notes}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No session notes added.
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      className="text-primary px-0"
                      onClick={() => navigate(`/feed?session=${session.id}`)}
                    >
                      View catches in feed
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sessions;
