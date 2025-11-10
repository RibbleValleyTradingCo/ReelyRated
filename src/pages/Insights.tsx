import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2, Trophy, Fish, Anchor, BarChart3, Layers, CalendarDays, Sparkles, Scale, CloudSun, MapPin } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import type { DateRange } from "react-day-picker";

type CatchRow = Database["public"]["Tables"]["catches"]["Row"];

type AggregatedStats = {
  totalCatches: number;
  pbCatch: { weight: number | null; unit: string | null; label: string } | null;
  topVenue: string | null;
  topTimeOfDay: string | null;
  baitCounts: { name: string; count: number }[];
  methodCounts: { name: string; count: number }[];
  timeOfDayCounts: { name: string; count: number }[];
  speciesCounts: { name: string; count: number }[];
  venueCounts: { name: string; count: number }[];
  weatherCounts: { name: string; count: number }[];
  clarityCounts: { name: string; count: number }[];
  windCounts: { name: string; count: number }[];
  averageWeightKg: number | null;
  totalWeightKg: number;
  averageAirTemp: number | null;
  weightedCatchCount: number;
};

type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

type DatePreset = "all" | "last-30" | "season" | "last-session" | "custom";

const formatLabel = (value: string) => {
  if (!value) return "";
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ""))
    .join(" ");
};

const WEIGHT_CONVERSION = {
  lb: 0.453592,
  lbs: 0.453592,
  lb_oz: 0.453592,
  kg: 1,
};
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toKg = (weight: number | null, unit: string | null) => {
  if (!weight) return 0;
  if (!unit) return weight;
  const normalizedUnit = unit.toLowerCase();
  const multiplier = WEIGHT_CONVERSION[normalizedUnit as keyof typeof WEIGHT_CONVERSION];
  return multiplier ? weight * multiplier : weight;
};

const formatWeightDisplay = (kg: number | null) => {
  if (kg === null || Number.isNaN(kg)) {
    return "—";
  }
  const pounds = kg * 2.20462;
  return `${kg.toFixed(1)} kg (${pounds.toFixed(1)} lb)`;
};

const parseDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const endOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const startOfDay = (value: Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getCatchDate = (catchRow: CatchRow) => parseDate(catchRow.caught_at ?? catchRow.created_at);

const getCustomField = (catchRow: CatchRow, field: string) => {
  if (!catchRow.conditions || typeof catchRow.conditions !== "object") {
    return undefined;
  }
  const customFields = (catchRow.conditions as Record<string, unknown>).customFields;
  if (!customFields || typeof customFields !== "object") {
    return undefined;
  }
  const value = (customFields as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
};

const deriveMethodLabel = (catchRow: CatchRow) => {
  const baseMethod = catchRow.method || "";
  if (baseMethod && baseMethod !== "other") {
    return formatLabel(baseMethod);
  }

  const customMethod = getCustomField(catchRow, "method");

  if (customMethod) {
    return formatLabel(customMethod);
  }

  if (baseMethod === "other") {
    return "Other method";
  }

  return "";
};

const deriveSpeciesLabel = (catchRow: CatchRow) => {
  if (catchRow.species) {
    if (catchRow.species === "other") {
      const customSpecies = getCustomField(catchRow, "species");
      return customSpecies ? formatLabel(customSpecies) : "Other species";
    }
    const label = getFreshwaterSpeciesLabel(catchRow.species);
    return label || formatLabel(catchRow.species);
  }

  const customSpecies = getCustomField(catchRow, "species");
  return customSpecies ? formatLabel(customSpecies) : "";
};

const deriveTimeOfDayLabel = (catchRow: CatchRow) => {
  if (catchRow.time_of_day) {
    return formatLabel(catchRow.time_of_day);
  }

  const timestamp = catchRow.caught_at ?? catchRow.created_at;
  if (!timestamp) return "Unknown";

  const parsedDate = new Date(timestamp);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Unknown";
  }

  const hour = parsedDate.getHours();
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
};

const getConditionValue = (catchRow: CatchRow, key: string) => {
  if (!catchRow.conditions || typeof catchRow.conditions !== "object") {
    return undefined;
  }
  const value = (catchRow.conditions as Record<string, unknown>)[key];
  if (typeof value === "string") {
    return value;
  }
  return undefined;
};

const getConditionNumber = (catchRow: CatchRow, key: string) => {
  if (!catchRow.conditions || typeof catchRow.conditions !== "object") {
    return undefined;
  }
  const value = (catchRow.conditions as Record<string, unknown>)[key];
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
};

const aggregateStats = (catches: CatchRow[]): AggregatedStats => {
  if (!catches.length) {
    return {
      totalCatches: 0,
      pbCatch: null,
      topVenue: null,
      topTimeOfDay: null,
      baitCounts: [],
      methodCounts: [],
      timeOfDayCounts: [],
      speciesCounts: [],
      venueCounts: [],
      weatherCounts: [],
      clarityCounts: [],
      windCounts: [],
      averageWeightKg: null,
      totalWeightKg: 0,
      averageAirTemp: null,
      weightedCatchCount: 0,
    };
  }

  const baitMap = new Map<string, number>();
  const methodMap = new Map<string, number>();
  const venueMap = new Map<string, number>();
  const timeOfDayMap = new Map<string, number>();
  const speciesMap = new Map<string, number>();
  const weatherMap = new Map<string, number>();
  const clarityMap = new Map<string, number>();
  const windMap = new Map<string, number>();

  let pb: CatchRow | null = null;
  let weightSumKg = 0;
  let weightCount = 0;
  let airTempSum = 0;
  let airTempCount = 0;

  catches.forEach((catchRow) => {
    if (catchRow.bait_used) {
      const baitLabel = formatLabel(catchRow.bait_used);
      baitMap.set(baitLabel, (baitMap.get(baitLabel) || 0) + 1);
    }

    const methodLabel = deriveMethodLabel(catchRow);
    if (methodLabel) {
      methodMap.set(methodLabel, (methodMap.get(methodLabel) || 0) + 1);
    }

    if (catchRow.location) {
      venueMap.set(catchRow.location, (venueMap.get(catchRow.location) || 0) + 1);
    }

    const timeLabel = deriveTimeOfDayLabel(catchRow);
    timeOfDayMap.set(timeLabel, (timeOfDayMap.get(timeLabel) || 0) + 1);

    const speciesLabel = deriveSpeciesLabel(catchRow);
    if (speciesLabel) {
      speciesMap.set(speciesLabel, (speciesMap.get(speciesLabel) || 0) + 1);
    }

    if (catchRow.weight) {
      const currentKg = toKg(catchRow.weight, catchRow.weight_unit);
      weightSumKg += currentKg;
      weightCount += 1;

      if (!pb) {
        pb = catchRow;
      } else {
        const pbKg = toKg(pb.weight, pb.weight_unit);
        if (currentKg > pbKg) {
          pb = catchRow;
        }
      }
    }

    const weatherRaw = getConditionValue(catchRow, "weather");
    if (weatherRaw) {
      const weatherLabel = formatLabel(weatherRaw);
      weatherMap.set(weatherLabel, (weatherMap.get(weatherLabel) || 0) + 1);
    }

    const clarityRaw = getConditionValue(catchRow, "waterClarity");
    if (clarityRaw) {
      const clarityLabel = formatLabel(clarityRaw);
      clarityMap.set(clarityLabel, (clarityMap.get(clarityLabel) || 0) + 1);
    }

    const windRaw = getConditionValue(catchRow, "windDirection");
    if (windRaw) {
      const windLabel = windRaw.length <= 4 ? windRaw.toUpperCase() : formatLabel(windRaw);
      windMap.set(windLabel, (windMap.get(windLabel) || 0) + 1);
    }

    const airTemp = getConditionNumber(catchRow, "airTemp");
    if (typeof airTemp === "number") {
      airTempSum += airTemp;
      airTempCount += 1;
    }
  });

  const mappedToArray = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  const pbCatch = pb
    ? {
        weight: pb.weight,
        unit: pb.weight_unit,
        label: pb.weight
          ? `${pb.weight} ${pb.weight_unit ? pb.weight_unit.toLowerCase() : ""}`.trim()
          : "No weight recorded",
      }
    : null;

  const sortedVenues = mappedToArray(venueMap);
  const sortedTime = mappedToArray(timeOfDayMap);
  const sortedBait = mappedToArray(baitMap).slice(0, 6);
  const sortedMethod = mappedToArray(methodMap).slice(0, 6);
  const sortedSpecies = mappedToArray(speciesMap);
  const sortedWeather = mappedToArray(weatherMap);
  const sortedClarity = mappedToArray(clarityMap);
  const sortedWind = mappedToArray(windMap);

  return {
    totalCatches: catches.length,
    pbCatch,
    topVenue: sortedVenues[0]?.name ?? null,
    topTimeOfDay: sortedTime[0]?.name ?? null,
    baitCounts: sortedBait,
    methodCounts: sortedMethod,
    timeOfDayCounts: sortedTime,
    speciesCounts: sortedSpecies,
    venueCounts: sortedVenues,
    weatherCounts: sortedWeather,
    clarityCounts: sortedClarity,
    windCounts: sortedWind,
    averageWeightKg: weightCount ? weightSumKg / weightCount : null,
    totalWeightKg: weightSumKg,
    averageAirTemp: airTempCount ? airTempSum / airTempCount : null,
    weightedCatchCount: weightCount,
  };
};

const Insights = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [catches, setCatches] = useState<CatchRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [selectedSessionId, setSelectedSessionId] = useState<string>("all");
  const [selectedVenue, setSelectedVenue] = useState<string>("all");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [customRangeOpen, setCustomRangeOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      const [catchesResponse, sessionsResponse] = await Promise.all([
        supabase
          .from("catches")
          .select(
            "id, created_at, caught_at, weight, weight_unit, location, bait_used, method, time_of_day, conditions, session_id, species"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("sessions")
          .select("id, title, venue, date, created_at")
          .eq("user_id", user.id)
          .order("date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
      ]);

      if (catchesResponse.error) {
        setError("We couldn't load your catches right now. Please try again shortly.");
        setCatches([]);
      } else {
        setCatches((catchesResponse.data as CatchRow[]) ?? []);
      }

      if (sessionsResponse.error) {
        console.warn("Failed to load sessions for insights", sessionsResponse.error);
        setSessions([]);
      } else {
        setSessions((sessionsResponse.data as SessionRow[]) ?? []);
      }

      setLoading(false);
    };

    void fetchData();
  }, [user]);

  const venueOptions = useMemo(() => {
    const venues = new Set<string>();
    catches.forEach((catchRow) => {
      if (catchRow.location) {
        venues.add(catchRow.location);
      }
    });
    return Array.from(venues).sort((a, b) => a.localeCompare(b));
  }, [catches]);

  const sessionOptions = useMemo(
    () =>
      sessions.map((session) => {
        const sessionDate = session.date ? parseDate(session.date) : parseDate(session.created_at);
        const fallbackLabel = sessionDate ? sessionDate.toLocaleDateString() : `Session ${session.id.slice(0, 6)}`;
        return {
          value: session.id,
          label: session.title ? session.title : fallbackLabel,
        };
      }),
    [sessions]
  );

  useEffect(() => {
    if (selectedVenue !== "all" && !venueOptions.includes(selectedVenue)) {
      setSelectedVenue("all");
    }
  }, [venueOptions, selectedVenue]);

  useEffect(() => {
    if (selectedSessionId !== "all" && !sessions.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId("all");
    }
  }, [sessions, selectedSessionId]);

  const latestSessionId = useMemo(() => {
    let candidate: { id: string; timestamp: number } | null = null;

    catches.forEach((catchRow) => {
      if (!catchRow.session_id) return;
      const catchDate = getCatchDate(catchRow);
      const timestamp = catchDate ? catchDate.getTime() : 0;
      if (!candidate || timestamp > candidate.timestamp) {
        candidate = { id: catchRow.session_id, timestamp };
      }
    });

    if (candidate) {
      return candidate.id;
    }

    let fallback: { id: string; timestamp: number } | null = null;
    sessions.forEach((session) => {
      const sessionDate = session.date ? parseDate(session.date) : parseDate(session.created_at);
      const timestamp = sessionDate ? sessionDate.getTime() : 0;
      if (!fallback || timestamp > fallback.timestamp) {
        fallback = { id: session.id, timestamp };
      }
    });

    return fallback?.id ?? null;
  }, [catches, sessions]);

  useEffect(() => {
    if (datePreset === "last-session" && latestSessionId) {
      setSelectedSessionId((previous) => (previous === latestSessionId ? previous : latestSessionId));
    }
  }, [datePreset, latestSessionId]);

  const effectiveSessionId = useMemo(() => {
    if (selectedSessionId !== "all") {
      return selectedSessionId;
    }
    if (datePreset === "last-session" && latestSessionId) {
      return latestSessionId;
    }
    return null;
  }, [selectedSessionId, datePreset, latestSessionId]);

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case "last-30": {
        const end = endOfDay(now);
        const start = startOfDay(new Date(now.getTime() - 29 * DAY_IN_MS));
        return { start, end };
      }
      case "season": {
        const start = startOfDay(new Date(now.getFullYear(), 0, 1));
        const end = endOfDay(now);
        return { start, end };
      }
      case "custom": {
        if (!customRange) {
          return { start: null, end: null };
        }
        const start = customRange.from ? startOfDay(customRange.from) : null;
        const end = customRange.to
          ? endOfDay(customRange.to)
          : customRange.from
          ? endOfDay(customRange.from)
          : null;
        return { start, end };
      }
      case "last-session": {
        if (!effectiveSessionId) {
          return { start: null, end: null };
        }
        const sessionCatches = catches.filter((catchRow) => catchRow.session_id === effectiveSessionId);
        const timestamps = sessionCatches
          .map((catchRow) => getCatchDate(catchRow))
          .filter((date): date is Date => Boolean(date))
          .map((date) => date.getTime());

        if (timestamps.length > 0) {
          const minTime = Math.min(...timestamps);
          const maxTime = Math.max(...timestamps);
          return { start: startOfDay(new Date(minTime)), end: endOfDay(new Date(maxTime)) };
        }

        const session = sessions.find((item) => item.id === effectiveSessionId);
        if (session?.date) {
          const sessionDate = parseDate(session.date);
          if (sessionDate) {
            return { start: startOfDay(sessionDate), end: endOfDay(sessionDate) };
          }
        }

        return { start: null, end: null };
      }
      default:
        return { start: null, end: null };
    }
  }, [datePreset, catches, sessions, effectiveSessionId, customRange]);

  const filteredCatches = useMemo(() => {
    return catches.filter((catchRow) => {
      if (effectiveSessionId && catchRow.session_id !== effectiveSessionId) {
        return false;
      }

      if (selectedVenue !== "all") {
        if (!catchRow.location || catchRow.location !== selectedVenue) {
          return false;
        }
      }

      const catchDate = getCatchDate(catchRow);

      if (dateRange.start && (!catchDate || catchDate < dateRange.start)) {
        return false;
      }

      if (dateRange.end && (!catchDate || catchDate > dateRange.end)) {
        return false;
      }

      return true;
    });
  }, [catches, effectiveSessionId, selectedVenue, dateRange]);

  const stats = useMemo(() => aggregateStats(filteredCatches), [filteredCatches]);

  const sessionsCount = useMemo(() => {
    if (effectiveSessionId) {
      return filteredCatches.some((catchRow) => catchRow.session_id === effectiveSessionId) ? 1 : 0;
    }
    const ids = new Set<string>();
    filteredCatches.forEach((catchRow) => {
      if (catchRow.session_id) {
        ids.add(catchRow.session_id);
      }
    });
    return ids.size;
  }, [filteredCatches, effectiveSessionId]);

  const mostCommonSpecies = stats.speciesCounts[0]?.name ?? null;
  const mostCommonSpeciesCount = stats.speciesCounts[0]?.count ?? 0;
  const averageWeightLabel = formatWeightDisplay(stats.averageWeightKg);
  const weightedCatchCount = stats.weightedCatchCount;
  const averagePerSession = sessionsCount > 0 ? stats.totalCatches / sessionsCount : 0;
  const averagePerSessionLabel = sessionsCount > 0 ? averagePerSession.toFixed(1) : "—";
  const topWeather = stats.weatherCounts[0]?.name ?? null;
  const topClarity = stats.clarityCounts[0]?.name ?? null;
  const topWind = stats.windCounts[0]?.name ?? null;
  const averageAirTempLabel = stats.averageAirTemp !== null ? `${stats.averageAirTemp.toFixed(1)}°C` : "—";

  const speciesChartData = useMemo(() => stats.speciesCounts.slice(0, 6), [stats.speciesCounts]);
  const venueLeaderboard = useMemo(() => stats.venueCounts.slice(0, 5), [stats.venueCounts]);
  const monthlyCounts = useMemo(() => {
    const counts = new Map<string, { date: Date; count: number }>();
    filteredCatches.forEach((catchRow) => {
      const date = getCatchDate(catchRow);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!counts.has(key)) {
        counts.set(key, { date: new Date(date.getFullYear(), date.getMonth(), 1), count: 0 });
      }
      counts.get(key)!.count += 1;
    });

    const sorted = Array.from(counts.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    const recent = sorted.slice(-12);
    const formatter = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
    return recent.map((entry) => ({ label: formatter.format(entry.date), count: entry.count }));
  }, [filteredCatches]);

  const sessionSummaries = useMemo(() => {
    const map = new Map<string, number>();
    filteredCatches.forEach((catchRow) => {
      if (catchRow.session_id) {
        map.set(catchRow.session_id, (map.get(catchRow.session_id) || 0) + 1);
      }
    });

    return Array.from(map.entries())
      .map(([sessionId, count]) => {
        const session = sessions.find((item) => item.id === sessionId);
        const label = session?.title ? session.title : `Session ${sessionId.slice(0, 6)}`;
        const dateLabel = session?.date
          ? new Date(session.date).toLocaleDateString()
          : session?.created_at
          ? new Date(session.created_at).toLocaleDateString()
          : null;
        return { id: sessionId, count, label, dateLabel };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [filteredCatches, sessions]);

  const topSession = sessionSummaries[0] ?? null;

  const trendLineData = useMemo(() => {
    if (!monthlyCounts.length) return [];
    return [
      {
        id: "Catches",
        data: monthlyCounts.map((entry) => ({ x: entry.label, y: entry.count })),
      },
    ];
  }, [monthlyCounts]);

  const timeOfDayData = useMemo(
    () =>
      stats.timeOfDayCounts.map((item) => ({ label: item.name, catches: item.count })),
    [stats.timeOfDayCounts]
  );

  const baitData = useMemo(
    () =>
      stats.baitCounts.map((item) => ({ label: item.name, catches: item.count })),
    [stats.baitCounts]
  );

  const methodData = useMemo(
    () =>
      stats.methodCounts.map((item) => ({ label: item.name, catches: item.count })),
    [stats.methodCounts]
  );

  const speciesBarData = useMemo(
    () => speciesChartData.map((item) => ({ label: item.name, catches: item.count })),
    [speciesChartData]
  );

  const sessionsDisabled = sessionOptions.length === 0;
  const showLastSessionHint = datePreset === "last-session" && !latestSessionId;
  const noCatchesOverall = catches.length === 0;

  const customRangeLabel = useMemo(() => {
    if (customRange?.from && customRange?.to) {
      return `${customRange.from.toLocaleDateString()} – ${customRange.to.toLocaleDateString()}`;
    }
    if (customRange?.from) {
      return `${customRange.from.toLocaleDateString()} – …`;
    }
    return "Pick custom range";
  }, [customRange]);

  const customRangeActive = datePreset === "custom";

  const handleDatePresetChange = (value: DatePreset) => {
    if (value === "last-session" && !latestSessionId) {
      setDatePreset("all");
      return;
    }

    if (value === "custom") {
      setDatePreset("custom");
      setCustomRangeOpen(true);
      return;
    }

    setCustomRange(undefined);
    setCustomRangeOpen(false);
    setDatePreset(value);
  };

  const handleCustomRangeSelect = (range: DateRange | undefined) => {
    if (!range || (!range.from && !range.to)) {
      setCustomRange(undefined);
      setDatePreset("all");
      return;
    }
    setCustomRange(range);
    setDatePreset("custom");
    setSelectedSessionId("all");
    if (range.from && range.to) {
      setCustomRangeOpen(false);
    }
  };

  const handleClearCustomRange = () => {
    setCustomRange(undefined);
    if (datePreset === "custom") {
      setDatePreset("all");
    }
    setCustomRangeOpen(false);
  };

  const handleSessionChange = (value: string) => {
    if (datePreset === "last-session") {
      if (value === "all" || (latestSessionId && value !== latestSessionId)) {
        setDatePreset("all");
      }
    }
    setSelectedSessionId(value);
  };

  const handleVenueChange = (value: string) => {
    setSelectedVenue(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40">
      <Navbar />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">Your angling insights</h1>
          <p className="text-muted-foreground">
            A quick look at how your catches stack up across venues, times of day, and favourite tactics.
          </p>
        </div>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Crunching the numbers…
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-muted-foreground">Time range</Label>
                  <Select value={datePreset} onValueChange={(value) => handleDatePresetChange(value as DatePreset)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="last-30">Last 30 days</SelectItem>
                      <SelectItem value="season">This season</SelectItem>
                      <SelectItem value="last-session" disabled={!latestSessionId}>
                        Last session
                      </SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="min-h-[16px]" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-muted-foreground">Session</Label>
                  <Select value={selectedSessionId} onValueChange={handleSessionChange}>
                    <SelectTrigger disabled={sessionsDisabled} className="w-full">
                      <SelectValue placeholder="All sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sessions</SelectItem>
                      {sessionOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="min-h-[16px] text-xs text-muted-foreground">
                    {sessionsDisabled ? "Log a session to enable this filter." : ""}
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-muted-foreground">Venue</Label>
                  <Select value={selectedVenue} onValueChange={handleVenueChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All venues" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All venues</SelectItem>
                      {venueOptions.map((venue) => (
                        <SelectItem key={venue} value={venue}>
                          {venue}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="min-h-[16px]" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-medium text-muted-foreground">Custom range</Label>
                  <Popover open={customRangeOpen} onOpenChange={setCustomRangeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          customRangeActive ? "border-primary text-primary shadow-sm" : "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>{customRangeLabel}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0" sideOffset={8}>
                      <Calendar
                        mode="range"
                        numberOfMonths={2}
                        selected={customRange}
                        onSelect={handleCustomRangeSelect}
                        defaultMonth={customRange?.from}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                      <div className="flex items-center justify-between border-t p-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleClearCustomRange}
                          disabled={!customRange?.from && !customRange?.to}
                        >
                          Clear
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCustomRangeOpen(false)}
                          disabled={!customRange?.from}
                        >
                          Done
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                  <div className="min-h-[16px]" />
                </div>
              </div>
              {showLastSessionHint && (
                <p className="mt-3 text-xs text-muted-foreground">
                  You haven&apos;t logged any sessions yet. Create one to unlock the “Last session” range.
                </p>
              )}
            </div>

            {error ? (
              <Card className="mb-6 border-destructive/30 bg-destructive/10 text-destructive">
                <CardContent className="py-6">
                  <p>{error}</p>
                </CardContent>
              </Card>
            ) : stats.totalCatches === 0 ? (
              <Card className="mb-6">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <p>
                    {noCatchesOverall
                      ? "You haven’t logged any catches yet. Record your next session to unlock insights."
                      : "No catches match these filters yet. Adjust your selections or log a new trip to see data here."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total catches</CardTitle>
                      <Fish className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.totalCatches}</p>
                      <p className="text-xs text-muted-foreground">Logged with these filters</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Personal best</CardTitle>
                      <Trophy className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{stats.pbCatch?.label ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Heaviest catch in this range</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Average weight</CardTitle>
                      <Scale className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold leading-tight">{averageWeightLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {weightedCatchCount > 0
                          ? `Across ${weightedCatchCount} weighed catch${weightedCatchCount === 1 ? "" : "es"}`
                          : "No weights recorded in this view"}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Sessions in range</CardTitle>
                      <Layers className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold">{sessionsCount}</p>
                      <p className="text-xs text-muted-foreground">
                        {sessionsCount === 0
                          ? "No sessions tagged"
                          : `Avg ${averagePerSessionLabel} catches per session`}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Most common species</CardTitle>
                      <Sparkles className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg font-semibold leading-tight">
                        {mostCommonSpecies ?? "No species data yet"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mostCommonSpecies
                          ? `Seen ${mostCommonSpeciesCount} time${mostCommonSpeciesCount === 1 ? "" : "s"}`
                          : "Log more catches to surface your go-to species."}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Catch trend
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Monthly catch totals for the selected range.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {monthlyCounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Add more catches to reveal the timeline.</p>
                      ) : (
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={monthlyCounts} margin={{ top: 24, right: 24, bottom: 40, left: 8 }}>
                              <defs>
                                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                              <XAxis
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                                        <p className="font-medium">{payload[0].payload.label}</p>
                                        <p>{payload[0].value} catches</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="count"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fill="url(#trendGradient)"
                                fillOpacity={1}
                                dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, stroke: "hsl(var(--background))", r: 4 }}
                                activeDot={{ r: 6 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Species mix
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Top species landed during this period.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {speciesChartData.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No species data available for this view.</p>
                      ) : (
                        <div className="h-72 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[...speciesBarData].reverse()}
                              layout="horizontal"
                              margin={{ top: 24, right: 16, bottom: 16, left: 160 }}
                            >
                              <defs>
                                <linearGradient id="speciesGradient" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.9} />
                                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.25} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                              <XAxis
                                type="number"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                              />
                              <YAxis
                                type="category"
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={150}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                                        <p className="font-medium">{payload[0].payload.label}</p>
                                        <p>{payload[0].value} catches</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="catches" fill="url(#speciesGradient)" radius={[0, 6, 6, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <BarChart3 className="h-4 w-4 text-primary" />
                        Time of day performance
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Track when your catches most often happen.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {stats.timeOfDayCounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Add more catches to see trends.</p>
                      ) : (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={timeOfDayData} margin={{ top: 24, right: 16, bottom: 40, left: 8 }}>
                              <defs>
                                <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.85} />
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                              <XAxis
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                              />
                              <YAxis
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                                        <p className="font-medium">{payload[0].payload.label}</p>
                                        <p>{payload[0].value} catches</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="catches" fill="url(#timeGradient)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Anchor className="h-4 w-4 text-primary" />
                        Favourite baits
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        The lures and baits that seal the deal most often.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {stats.baitCounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No bait data logged yet.</p>
                      ) : (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={[...baitData].reverse()}
                              layout="horizontal"
                              margin={{ top: 24, right: 24, bottom: 16, left: 160 }}
                            >
                              <defs>
                                <linearGradient id="baitGradient" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.85} />
                                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.25} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                              <XAxis
                                type="number"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                              />
                              <YAxis
                                type="category"
                                dataKey="label"
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={150}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    return (
                                      <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                                        <p className="font-medium">{payload[0].payload.label}</p>
                                        <p>{payload[0].value} catches</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Bar dataKey="catches" fill="url(#baitGradient)" radius={[0, 6, 6, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <Anchor className="h-4 w-4 text-primary" />
                      Productive methods
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Compare which techniques have delivered the goods.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {stats.methodCounts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No method data captured yet.</p>
                    ) : (
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={methodData} margin={{ top: 32, right: 24, bottom: 48, left: 8 }}>
                            <defs>
                              <linearGradient id="methodGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                            <XAxis
                              dataKey="label"
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              angle={-20}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              stroke="hsl(var(--muted-foreground))"
                              fontSize={12}
                              tickLine={false}
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  return (
                                    <div className="rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
                                      <p className="font-medium">{payload[0].payload.label}</p>
                                      <p>{payload[0].value} catches</p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Bar dataKey="catches" fill="url(#methodGradient)" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <CloudSun className="h-4 w-4 text-primary" />
                        Conditions snapshot
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">What the weather says about your fishing.</p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Prime time</span>
                          <span className="font-medium text-foreground">{stats.topTimeOfDay ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Favourite weather</span>
                          <span className="font-medium text-foreground">{topWeather ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Water clarity sweet spot</span>
                          <span className="font-medium text-foreground">{topClarity ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Prevailing wind</span>
                          <span className="font-medium text-foreground">{topWind ?? "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Average air temp</span>
                          <span className="font-medium text-foreground">{averageAirTempLabel}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <MapPin className="h-4 w-4 text-primary" />
                        Venue leaderboard
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">Where you’re finding the most success.</p>
                    </CardHeader>
                    <CardContent>
                      {venueLeaderboard.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No venue data captured for this view.</p>
                      ) : (
                        <ol className="space-y-2 text-sm">
                          {venueLeaderboard.map((venue, index) => (
                            <li key={venue.name} className="flex items-center justify-between gap-4">
                              <span className="font-medium text-foreground">
                                {index + 1}. {venue.name}
                              </span>
                              <span className="text-muted-foreground">
                                {venue.count} catch{venue.count === 1 ? "" : "es"}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <Layers className="h-4 w-4 text-primary" />
                        Session highlights
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">How your logged trips stack up.</p>
                    </CardHeader>
                    <CardContent>
                      {sessionsCount === 0 ? (
                        <p className="text-sm text-muted-foreground">No sessions recorded for the current filters.</p>
                      ) : (
                        <div className="space-y-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Total sessions</span>
                            <span className="font-medium text-foreground">{sessionsCount}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Avg catches per session</span>
                            <span className="font-medium text-foreground">{averagePerSessionLabel}</span>
                          </div>
                          {topSession && (
                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                              <p className="text-xs uppercase text-muted-foreground">Top session</p>
                              <p className="text-sm font-semibold text-foreground">{topSession.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {topSession.dateLabel ? `${topSession.dateLabel} · ` : ""}
                                {topSession.count} catch{topSession.count === 1 ? "" : "es"}
                              </p>
                            </div>
                          )}
                          {sessionSummaries.length > (topSession ? 1 : 0) && (
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-muted-foreground">Other stand-out trips</p>
                              <ul className="space-y-1">
                                {(topSession ? sessionSummaries.slice(1) : sessionSummaries).map((session) => (
                                  <li key={session.id} className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{session.label}</span>
                                    <span>{session.count}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Insights;
