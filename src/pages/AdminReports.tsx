import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/components/AuthProvider";
import { isAdminUser } from "@/lib/admin";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface ReportRow {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  created_at: string;
  reporter: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

const AdminReports = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "catch" | "comment" | "profile">("all");

  useEffect(() => {
    if (!loading) {
      if (!isAdminUser(user?.id)) {
        toast.error("Admin access required");
        navigate("/feed");
      }
    }
  }, [loading, user, navigate]);

  const fetchReports = useCallback(async (options: { silently?: boolean } = {}) => {
    if (!user || !isAdminUser(user.id)) return;
    if (!options.silently) {
      setIsLoading(true);
    }
    const { data, error } = await supabase
      .from("reports")
      .select(
        "id, target_type, target_id, reason, created_at, reporter:reporter_id (id, username, avatar_url)"
      )
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReports(data as unknown as ReportRow[]);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (isAdminUser(user?.id)) {
      void fetchReports();
    }
  }, [fetchReports, user]);

  useEffect(() => {
    if (!isAdminUser(user?.id)) return;

    const channel = supabase
      .channel("admin-reports-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "reports",
        },
        () => {
          void fetchReports({ silently: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "reports",
        },
        () => {
          void fetchReports({ silently: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "reports",
        },
        () => {
          void fetchReports({ silently: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchReports, user]);

  const filteredReports = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((report) => report.target_type === filter);
  }, [reports, filter]);

  const handleViewTarget = useCallback(
    async (report: ReportRow) => {
      if (report.target_type === "catch") {
        navigate(`/catch/${report.target_id}`);
        return;
      }

      if (report.target_type === "profile") {
        navigate(`/profile/${report.target_id}`);
        return;
      }

      if (report.target_type === "comment") {
        const { data, error } = await supabase
          .from("catch_comments")
          .select("catch_id")
          .eq("id", report.target_id)
          .maybeSingle();

        if (error || !data) {
          toast.error("Unable to open reported comment");
          return;
        }

        navigate(`/catch/${data.catch_id}`);
      }
    },
    [navigate]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reports dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Review user submitted reports for catches, comments, and profiles.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {(["all", "catch", "comment", "profile"] as const).map((type) => (
              <Button
                key={type}
                variant={filter === type ? "ocean" : "outline"}
                onClick={() => setFilter(type)}
              >
                {type === "all" ? "All reports" : type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading reports…</p>
            ) : filteredReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports yet.</p>
            ) : (
              filteredReports.map((report) => (
                <div key={report.id} className="rounded-lg border border-border/60 bg-card/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary" className="uppercase tracking-wide">
                        {report.target_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary"
                      onClick={() => void handleViewTarget(report)}
                    >
                      View target
                    </Button>
                  </div>
                  <p className="mt-3 text-sm text-foreground whitespace-pre-wrap">{report.reason}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Reported by {report.reporter?.username ?? report.reporter?.id ?? "Unknown"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminReports;
