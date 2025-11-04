import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UK_FISHERIES, getFreshwaterSpeciesLabel, normalizeVenueName } from "@/lib/freshwater-data";
import { toast } from "sonner";
import { resolveAvatarUrl } from "@/lib/storage";
import { format } from "date-fns";

type CustomFields = {
  species?: string;
};

type CatchConditions = {
  customFields?: CustomFields;
  gps?: {
    lat: number;
    lng: number;
  };
} | null;

interface VenueCatch {
  id: string;
  title: string;
  image_url: string;
  species: string | null;
  conditions: CatchConditions;
  weight: number | null;
  weight_unit: string | null;
  created_at: string;
  caught_at: string | null;
  hide_exact_spot: boolean | null;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  } | null;
}

const VenueDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [catches, setCatches] = useState<VenueCatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const venueName = useMemo(() => {
    if (!slug) return "";
    try {
      return normalizeVenueName(decodeURIComponent(slug));
    } catch {
      return normalizeVenueName(slug.replace(/-/g, " "));
    }
  }, [slug]);

  const canonicalVenue = useMemo(() => {
    const lower = venueName.toLowerCase();
    return UK_FISHERIES.find((fishery) => fishery.toLowerCase() === lower) ?? venueName;
  }, [venueName]);

  useEffect(() => {
    if (!venueName) {
      setIsLoading(false);
      return;
    }

    const loadVenueCatches = async () => {
      setIsLoading(true);
      const normalized = normalizeVenueName(venueName);

      const { data, error } = await supabase
        .from("catches")
        .select(`
          id,
          title,
          image_url,
          species,
          weight,
          weight_unit,
          created_at,
          caught_at,
          hide_exact_spot,
          conditions,
          profiles:user_id (username, avatar_path, avatar_url)
        `)
        .eq("location", normalized)
        .order("created_at", { ascending: false });

      if (error) {
        toast.error("Failed to load venue catches");
      } else {
        setCatches((data as VenueCatch[]) ?? []);
      }
      setIsLoading(false);
    };

    void loadVenueCatches();
  }, [venueName]);

  const filteredCatches = useMemo(() => {
    return catches.filter((catchItem) => {
      let matchesSpecies = true;
      if (speciesFilter !== "all") {
        const label =
          catchItem.species === "other"
            ? catchItem.conditions?.customFields?.species ?? "Other"
            : getFreshwaterSpeciesLabel(catchItem.species);
        matchesSpecies = (label ?? "").toLowerCase() === speciesFilter.toLowerCase();
      }

      let matchesDate = true;
      const catchDate = new Date(catchItem.caught_at ?? catchItem.created_at);
      if (startDate) {
        matchesDate = matchesDate && catchDate >= new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && catchDate <= end;
      }

      return matchesSpecies && matchesDate;
    });
  }, [catches, speciesFilter, startDate, endDate]);

  const speciesOptions = useMemo(() => {
    const labels = new Set<string>();
    catches.forEach((catchItem) => {
      const label =
        catchItem.species === "other"
          ? catchItem.conditions?.customFields?.species ?? "Other"
          : getFreshwaterSpeciesLabel(catchItem.species);
      if (label) {
        labels.add(label);
      }
    });
    return Array.from(labels).sort();
  }, [catches]);

  const topSpecies = useMemo(() => {
    const counts = new Map<string, number>();
    filteredCatches.forEach((catchItem) => {
      let label: string | null = null;
      if (catchItem.species === "other") {
        label = catchItem.conditions?.customFields?.species ?? null;
      } else {
        label = getFreshwaterSpeciesLabel(catchItem.species);
      }
      if (!label) return;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [filteredCatches]);

  const averageWeightBySpecies = useMemo(() => {
    const totals = new Map<string, { weight: number; count: number }>();
    filteredCatches.forEach((catchItem) => {
      if (!catchItem.weight) return;
      const label =
        catchItem.species === "other"
          ? catchItem.conditions?.customFields?.species ?? "Other"
          : getFreshwaterSpeciesLabel(catchItem.species);
      if (!label) return;
      const weightInLb = catchItem.weight_unit === "kg" ? catchItem.weight * 2.20462 : catchItem.weight;
      const entry = totals.get(label) ?? { weight: 0, count: 0 };
      entry.weight += weightInLb;
      entry.count += 1;
      totals.set(label, entry);
    });

    return Array.from(totals.entries())
      .map(([label, { weight, count }]) => ({
        label,
        average: weight / count,
        count,
      }))
      .sort((a, b) => b.average - a.average);
  }, [filteredCatches]);

  const gpsPoints = useMemo(() => {
    return filteredCatches
      .filter((catchItem) => !catchItem.hide_exact_spot)
      .map((catchItem) => catchItem.conditions?.gps)
      .filter((gps): gps is { lat: number; lng: number } => !!gps && typeof gps.lat === "number" && typeof gps.lng === "number");
  }, [filteredCatches]);

  const staticMapUrl = useMemo(() => {
    if (gpsPoints.length === 0) return null;
    const limited = gpsPoints.slice(0, 10);
    const avgLat = limited.reduce((acc, point) => acc + point.lat, 0) / limited.length;
    const avgLng = limited.reduce((acc, point) => acc + point.lng, 0) / limited.length;
    const markers = limited
      .map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)},red`)
      .join("|");
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${avgLat.toFixed(5)},${avgLng.toFixed(5)}&zoom=12&size=640x320&markers=${markers}`;
  }, [gpsPoints]);

  const formatWeight = (weight: number | null, unit: string | null) => {
    if (!weight) return "";
    return `${weight}${unit === "kg" ? "kg" : "lb"}`;
  };

  if (!venueName) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">We couldn&apos;t determine that venue.</p>
              <Button onClick={() => navigate(-1)}>Go Back</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">{canonicalVenue}</h1>
            <p className="text-muted-foreground">
              Discover recent catches and species trends for this venue.
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter catches</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Species</label>
              <select
                value={speciesFilter}
                onChange={(event) => setSpeciesFilter(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="all">All species</option>
                {speciesOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setSpeciesFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
              >
                Reset filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top species here</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading species insights…</p>
            ) : topSpecies.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No catches logged here yet. Be the first to share your session!
              </p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {topSpecies.map(([species, count]) => (
                  <Badge key={species} variant="secondary" className="text-sm py-1 px-2">
                    {species} • {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Catches</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading catches…</p>
            ) : filteredCatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No catches logged for this venue yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredCatches.map((catchItem) => (
                  <Card
                    key={catchItem.id}
                    className="overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-0">
                      <img
                        src={catchItem.image_url}
                        alt={catchItem.title}
                        className="h-52 w-full object-cover"
                      />
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{catchItem.title}</h3>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(catchItem.created_at), "dd MMM yyyy")}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Avatar className="h-8 w-8">
                            <AvatarImage
                              src={
                                resolveAvatarUrl({
                                  path: catchItem.profiles?.avatar_path ?? null,
                                  legacyUrl: catchItem.profiles?.avatar_url ?? null,
                                }) ?? ""
                              }
                            />
                            <AvatarFallback>
                              {catchItem.profiles?.username?.[0]?.toUpperCase() ?? "A"}
                            </AvatarFallback>
                          </Avatar>
                          <span>{catchItem.profiles?.username ?? "Unknown angler"}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm">
                          <Badge variant="outline">
                            {catchItem.species === "other"
                              ? catchItem.conditions?.customFields?.species ?? "Other"
                              : getFreshwaterSpeciesLabel(catchItem.species)}
                          </Badge>
                          {catchItem.weight && (
                            <Badge variant="outline">{formatWeight(catchItem.weight, catchItem.weight_unit)}</Badge>
                          )}
                        </div>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/catch/${catchItem.id}`}>View Catch</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average weight per species</CardTitle>
          </CardHeader>
          <CardContent>
            {averageWeightBySpecies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Not enough data yet.</p>
            ) : (
              <div className="space-y-2">
                {averageWeightBySpecies.map(({ label, average, count }) => (
                  <div key={label} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{label}</span>
                    <span className="text-muted-foreground">
                      {average.toFixed(1)} lb • {count} catch{count === 1 ? "" : "es"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {staticMapUrl && (
          <Card>
            <CardHeader>
              <CardTitle>Typical catch area</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Based on recent catches that shared GPS pins.
              </p>
              <div className="overflow-hidden rounded-xl border border-border/60">
                <img src={staticMapUrl} alt="Typical catch area map" className="h-64 w-full object-cover" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VenueDetail;
