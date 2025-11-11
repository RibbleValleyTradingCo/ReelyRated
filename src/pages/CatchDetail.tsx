import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Fish as FishIcon,
  Wrench,
  Star,
  Clock,
  Wind,
  Thermometer,
  Droplets,
  Eye,
  EyeOff,
  Heart,
  Share2,
  Copy,
  Trash2,
  Layers,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { CatchComments } from "@/components/CatchComments";
import { createNotification } from "@/lib/notifications";
import { getProfilePath } from "@/lib/profile";
import { resolveAvatarUrl } from "@/lib/storage";
import { canViewCatch, shouldShowExactLocation } from "@/lib/visibility";
import type { Database } from "@/integrations/supabase/types";
import html2canvas from "html2canvas";
import ShareCard from "@/components/ShareCard";
import ReportButton from "@/components/ReportButton";

type CustomFields = {
  species?: string;
  method?: string;
};

type CatchConditions = {
  customFields?: CustomFields;
  gps?: {
    lat: number;
    lng: number;
    accuracy?: number;
    label?: string;
  };
  weather?: string;
  airTemp?: number;
  waterClarity?: string;
  windDirection?: string;
  [key: string]: unknown;
} | null;

type VisibilityType = Database["public"]["Enums"]["visibility_type"];

interface CatchData {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  location: string | null;
  species: string | null;
  weight: number | null;
  weight_unit: string | null;
  length: number | null;
  length_unit: string | null;
  water_type: string | null;
  method: string | null;
  peg_or_swim: string | null;
  time_of_day: string | null;
  bait_used: string | null;
  equipment_used: string | null;
  caught_at: string | null;
  conditions: CatchConditions;
  tags: string[] | null;
  gallery_photos: string[] | null;
  video_url: string | null;
  visibility: VisibilityType | null;
  hide_exact_spot: boolean | null;
  allow_ratings: boolean | null;
  created_at: string;
  user_id: string;
  profiles: {
    username: string;
    avatar_path: string | null;
    avatar_url: string | null;
  };
  session: {
    id: string;
    title: string | null;
    venue: string | null;
    date: string | null;
  } | null;
}

interface Rating {
  rating: number;
  user_id: string;
  profiles: {
    username: string;
  } | null;
}

const CatchDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [catchData, setCatchData] = useState<CatchData | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [userRating, setUserRating] = useState<number>(5);
  const [hasRated, setHasRated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);
  const [reactionCount, setReactionCount] = useState(0);
  const [userHasReacted, setUserHasReacted] = useState(false);
  const [reactionLoading, setReactionLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const shareCardRef = useRef<HTMLDivElement | null>(null);
  const ownerId = catchData?.user_id ?? null;

  const ownerAvatarUrl = useMemo(
    () =>
      resolveAvatarUrl({
        path: catchData?.profiles?.avatar_path ?? null,
        legacyUrl: catchData?.profiles?.avatar_url ?? null,
      }),
    [catchData?.profiles?.avatar_path, catchData?.profiles?.avatar_url]
  );

  const fetchCatchData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("catches")
      .select("*, profiles:user_id (username, avatar_path, avatar_url), session:session_id (id, title, venue, date)")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to load catch");
      navigate("/feed");
    } else {
      setCatchData(data as CatchData);
    }
    setIsLoading(false);
  }, [id, navigate]);

  const fetchRatings = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("ratings")
      .select("rating, user_id, profiles:user_id (username)")
      .eq("catch_id", id);

    if (!error && data) {
      const ratingsData = data as Rating[];
      setRatings(ratingsData);
      if (user) {
        const userRatingExists = ratingsData.some(
          (ratingRow) => ratingRow.user_id === user.id
        );
        setHasRated(userRatingExists);
      } else {
        setHasRated(false);
      }
    }
  }, [id, user]);

  const fetchReactions = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("catch_reactions")
      .select("user_id")
      .eq("catch_id", id);

    if (error) {
      console.error("Failed to load reactions", error);
      return;
    }

    const reactions = data ?? [];
    setReactionCount(reactions.length);
    if (user) {
      setUserHasReacted(reactions.some((row) => row.user_id === user.id));
    } else {
      setUserHasReacted(false);
    }
  }, [id, user]);

  const checkFollowStatus = useCallback(async () => {
    if (!user || !ownerId || user.id === ownerId) {
      setIsFollowing(false);
      setFollowStatusLoaded(true);
      return;
    }

    const { data, error } = await supabase
      .from("profile_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", ownerId)
      .maybeSingle();

    if (error) {
      console.error("Failed to check following status", error);
      setFollowStatusLoaded(true);
      return;
    }
    setIsFollowing(!!data);
    setFollowStatusLoaded(true);
  }, [ownerId, user]);

  useEffect(() => {
    void fetchCatchData();
  }, [fetchCatchData]);

  useEffect(() => {
    void fetchRatings();
  }, [fetchRatings]);

  useEffect(() => {
    void fetchReactions();
  }, [fetchReactions]);

  useEffect(() => {
    if (!ownerId) {
      setIsFollowing(false);
      setFollowStatusLoaded(true);
      return;
    }
    if (!user || user.id === ownerId) {
      setIsFollowing(false);
      setFollowStatusLoaded(true);
      return;
    }
    setFollowStatusLoaded(false);
    void checkFollowStatus();
  }, [ownerId, user, checkFollowStatus]);

  useEffect(() => {
    if (!catchData) return;
    const needsFollowCheck =
      catchData.visibility === "followers" && user?.id !== catchData.user_id;
    if (needsFollowCheck && !followStatusLoaded) {
      return;
    }

    const allowed = canViewCatch(
      catchData.visibility,
      catchData.user_id,
      user?.id,
      isFollowing ? [catchData.user_id] : []
    );

    if (!allowed) {
      toast.error("You do not have access to this catch");
      navigate("/feed");
    }
  }, [catchData, followStatusLoaded, isFollowing, navigate, user?.id]);

  const handleDeleteCatch = useCallback(async () => {
    if (!user || !catchData) {
      toast.error("Unable to delete this catch");
      return;
    }

    setDeleteLoading(true);
    const { error } = await supabase
      .from("catches")
      .delete()
      .eq("id", catchData.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to delete catch");
      console.error("Failed to delete catch", error);
      setDeleteLoading(false);
      return;
    }

    toast.success("Catch removed");
    setDeleteDialogOpen(false);
    setDeleteLoading(false);
    navigate("/feed");
  }, [catchData, navigate, user]);

  const handleToggleFollow = async () => {
    if (!user || !catchData) {
      toast.error("Sign in to follow anglers");
      navigate("/auth");
      return;
    }

    if (user.id === catchData.user_id) return;

    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from("profile_follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", catchData.user_id);

      if (error) {
        toast.error("Failed to unfollow");
        console.error(error);
      } else {
        setIsFollowing(false);
        toast.success("Unfollowed angler");
      }
    } else {
      const { error } = await supabase.from("profile_follows").insert({
        follower_id: user.id,
        following_id: catchData.user_id,
      });

      if (error) {
        toast.error("Failed to follow angler");
        console.error(error);
      } else {
        setIsFollowing(true);
        toast.success("Following angler");
        const actorName = user.user_metadata?.username ?? user.email ?? "Someone";
        void createNotification({
          userId: catchData.user_id,
          type: "new_follower",
          payload: {
            message: `${actorName} started following you.`,
            extraData: {
              follower_username: actorName,
            },
          },
        });
      }
    }

    setFollowLoading(false);
  };

  const handleToggleReaction = async () => {
    if (!user || !catchData) {
      toast.error("Sign in to react");
      navigate("/auth");
      return;
    }

    setReactionLoading(true);

    if (userHasReacted) {
      const { error } = await supabase
        .from("catch_reactions")
        .delete()
        .eq("catch_id", catchData.id)
        .eq("user_id", user.id);

      if (!error) {
        setReactionCount((count) => Math.max(0, count - 1));
        setUserHasReacted(false);
      } else {
        toast.error("Couldn't remove reaction");
        console.error(error);
      }
    } else {
      const { error } = await supabase.from("catch_reactions").insert({
        catch_id: catchData.id,
        user_id: user.id,
        reaction: "like",
      });

      if (error) {
        if (error.code === "23505") {
          // unique constraint hit – treat as already reacted
          setUserHasReacted(true);
        } else {
          toast.error("Couldn't add reaction");
          console.error(error);
          setReactionLoading(false);
          return;
        }
      } else {
        setReactionCount((count) => count + 1);
        setUserHasReacted(true);
        if (catchData.user_id !== user.id) {
          const actorName = user.user_metadata?.username ?? user.email ?? "Someone";
          void createNotification({
            userId: catchData.user_id,
            type: "new_reaction",
            payload: {
              message: `${actorName} liked your catch "${catchData.title}".`,
              catchId: catchData.id,
              extraData: {
                catch_title: catchData.title,
              },
            },
          });
        }
      }
    }

    setReactionLoading(false);
  };

  const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined;
  const catchUrl = publicSiteUrl ? `${publicSiteUrl.replace(/\/$/, "")}/catch/${id}` : (typeof window !== "undefined" ? `${window.location.origin}/catch/${id}` : `/catch/${id}`);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(catchUrl);
      setShareCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setShareCopied(false), 2000);
    } catch (error) {
      console.error("Clipboard copy failed", error);
      toast.error("Unable to copy link");
    }
  };

  const handleShareWhatsApp = () => {
    if (!catchData) {
      window.open(`https://wa.me/?text=${encodeURIComponent(catchUrl)}`, "_blank");
      return;
    }
    const customFields = catchData.conditions?.customFields ?? {};
    const customSpecies = customFields.species;
    const speciesLabel = formatSpecies(catchData.species, customSpecies) ?? "a catch";
    const weightLabel = catchData.weight
      ? formatWeight(catchData.weight, catchData.weight_unit)
      : null;
    const messageParts = [
      `Check out ${catchData.title}`,
      weightLabel ? `(${weightLabel})` : null,
      speciesLabel ? `– ${speciesLabel}` : null,
      locationLabel ? `at ${locationLabel}` : null,
      `on ReelyRated: ${catchUrl}`,
    ].filter(Boolean);
    const waUrl = `https://wa.me/?text=${encodeURIComponent(messageParts.join(" "))}`;
    window.open(waUrl, "_blank");
  };

  const handleDownloadShareImage = async () => {
    if (!catchData || !shareCardRef.current) return;
    setDownloadLoading(true);
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: window.devicePixelRatio > 1 ? window.devicePixelRatio : 2,
      });
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeTitle = catchData.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      link.href = dataUrl;
      link.download = `${safeTitle || "catch"}-share.png`;
      link.click();
      toast.success("Share image saved");
    } catch (error) {
      console.error("Failed to generate share image", error);
      toast.error("Unable to generate share image");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleAddRating = async () => {
    if (!user || hasRated) return;
    if (!catchData || catchData.allow_ratings === false) {
      toast.error("Ratings are disabled for this catch");
      return;
    }

    const { error } = await supabase.from("ratings").insert({
      catch_id: id,
      user_id: user.id,
      rating: userRating,
    });

    if (error) {
      toast.error("Failed to add rating");
    } else {
      toast.success("Rating added!");
      setHasRated(true);
      fetchRatings();
      if (catchData && catchData.user_id !== user.id) {
        const actorName = user.user_metadata?.username ?? user.email ?? "Someone";
        void createNotification({
          userId: catchData.user_id,
          type: "new_rating",
          payload: {
            message: `${actorName} rated your catch "${catchData.title}" ${userRating}/10.`,
            catchId: catchData.id,
            extraData: {
              rating: userRating,
            },
          },
        });
      }
    }
  };

  const calculateAverageRating = () => {
    if (ratings.length === 0) return "No ratings yet";
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return `${(sum / ratings.length).toFixed(1)} / 10`;
  };

  const formatWeight = (weight: number | null, unit: string | null) => {
    if (!weight) return null;
    return `${weight}${unit === "kg" ? "kg" : "lb"}`;
  };

  const formatSpecies = (species: string | null, custom?: string) => {
    if (species === "other" && custom) {
      return custom;
    }
    return getFreshwaterSpeciesLabel(species);
  };

  const formatEnum = (value: string | null) => {
    if (!value) return "";
    return value.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (isLoading || !catchData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8">Loading...</div>
      </div>
    );
  }

  const customFields = catchData.conditions?.customFields ?? {};
  const customSpecies = customFields.species;
  const customMethod = customFields.method;
  const gpsData = catchData.conditions?.gps;
  const showGpsMap = !catchData.hide_exact_spot && gpsData;
  const profile = catchData.profiles ?? {
    username: "Unknown angler",
    avatar_url: null,
  };
  const shareSpecies = formatSpecies(catchData.species, customSpecies);
  const shareWeight = formatWeight(catchData.weight, catchData.weight_unit);
  const shareDate = catchData.caught_at ?? catchData.created_at;
  const formatSlugLabel = (value: string | null | undefined) => {
    if (!value) return "";
    return value
      .replace(/[-_]/g, " ")
      .split(" ")
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
      .join(" ");
  };
  const methodLabel = (() => {
    if (catchData.method === "other") {
      return customMethod ?? "Other";
    }
    if (catchData.method) {
      return formatSlugLabel(catchData.method);
    }
    return customMethod ?? "";
  })();
  const canShowExactLocation = shouldShowExactLocation(
    catchData.hide_exact_spot,
    catchData.user_id,
    user?.id
  );
  const locationLabel = canShowExactLocation
    ? catchData.location ?? undefined
    : undefined;
  const displayLocationLabel = locationLabel ?? (catchData.hide_exact_spot ? "Undisclosed venue" : catchData.location ?? undefined);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="pointer-events-none fixed -top-[2000px] left-0 opacity-0" ref={shareCardRef}>
          <ShareCard
            photoUrl={catchData.image_url}
            species={shareSpecies ?? undefined}
            weight={shareWeight ?? undefined}
            venue={locationLabel}
            date={shareDate ?? undefined}
            angler={profile.username}
          />
        </div>
        {/* Hero Section */}
        <div className="relative mb-8">
          <img
            src={catchData.image_url}
            alt={catchData.title}
            className="w-full h-[500px] object-cover rounded-xl"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-8 rounded-b-xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                {catchData.species && catchData.weight && (
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl font-bold text-white">
                      {catchData.weight}{catchData.weight_unit === 'kg' ? 'kg' : 'lb'}
                    </span>
                    <span className="text-2xl text-white/90">{formatSpecies(catchData.species, customSpecies)}</span>
                  </div>
                )}
                <h1 className="text-3xl font-bold text-white mb-2">{catchData.title}</h1>
                {canShowExactLocation && catchData.location ? (
                  <Link
                    to={`/venues/${encodeURIComponent(catchData.location)}`}
                    className="flex items-center gap-2 text-white/90 underline-offset-4 hover:underline"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{catchData.location}</span>
                  </Link>
                ) : catchData.hide_exact_spot ? (
                  <div className="flex items-center gap-2 text-white/70">
                    <MapPin className="w-4 h-4" />
                    <span>Undisclosed venue</span>
                  </div>
                ) : null}
                {catchData.session && (
                  <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                    <Layers className="w-4 h-4" />
                    <Link
                      to={`/sessions?session=${catchData.session.id}`}
                      className="underline-offset-4 hover:underline"
                    >
                      View session{catchData.session.title ? `: ${catchData.session.title}` : ""}
                    </Link>
                  </div>
                )}
                {catchData.caught_at && (
                  <div className="flex items-center gap-2 text-white/80 text-sm mt-1">
                    <Calendar className="w-4 h-4" />
                    <span>{format(new Date(catchData.caught_at), "MMMM dd, yyyy")}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={getProfilePath({ username: catchData.profiles?.username, id: catchData.user_id })}
                  className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg p-3"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={ownerAvatarUrl ?? ""} />
                    <AvatarFallback>{profile.username?.[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-white">{profile.username}</span>
                </Link>
                {user && user.id !== ownerId && (
                  <Button
                    size="sm"
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={`border border-white/40 text-white ${
                      isFollowing ? "bg-white/30 hover:bg-white/40" : "bg-white/10 hover:bg-white/20"
                    }`}
                    variant="ghost"
                  >
                    {followLoading ? "Updating…" : isFollowing ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card/60 px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant={userHasReacted ? "ocean" : "outline"}
              onClick={handleToggleReaction}
              disabled={reactionLoading || !catchData}
              className="flex items-center gap-2"
            >
              <Heart className="h-4 w-4" fill={userHasReacted ? "currentColor" : "none"} />
              {reactionLoading ? "Saving…" : userHasReacted ? "Liked" : "Like"}
            </Button>
            <span className="text-sm text-muted-foreground">{reactionCount} like{reactionCount === 1 ? "" : "s"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleShareWhatsApp} className="flex items-center gap-2">
              <Share2 className="h-4 w-4" />
              Share to WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyLink} className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              {shareCopied ? "Copied" : "Copy link"}
            </Button>
            <Button
              size="sm"
              variant="ocean"
              onClick={handleDownloadShareImage}
              disabled={downloadLoading}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {downloadLoading ? "Preparing…" : "Download share image"}
            </Button>
            <ReportButton
              targetType="catch"
              targetId={catchData.id}
              label="Report catch"
              className="text-destructive hover:text-destructive"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Story */}
            {catchData.description && (
              <Card>
                <CardHeader>
                  <CardTitle>The Story</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{catchData.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Gallery */}
            {catchData.gallery_photos && catchData.gallery_photos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Gallery</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {catchData.gallery_photos.map((photo, index) => (
                      <img
                        key={index}
                        src={photo}
                        alt={`Gallery ${index + 1}`}
                        className="w-full h-40 object-cover rounded-lg cursor-pointer hover:opacity-80 transition"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <CatchComments
              catchId={catchData.id}
              catchOwnerId={catchData.user_id}
              catchTitle={catchData.title}
              currentUserId={user?.id ?? null}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Rating */}
            {catchData.allow_ratings && (
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-accent fill-accent" />
                    <CardTitle>Rating</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">{calculateAverageRating()}</div>
                    <p className="text-sm text-muted-foreground mt-1">{ratings.length} ratings</p>
                  </div>

                  {user && !hasRated && (
                    <div className="space-y-3 pt-4 border-t">
                      <p className="font-medium text-sm">Rate this catch (1-10)</p>
                      <Slider
                        value={[userRating]}
                        onValueChange={(value) => setUserRating(value[0])}
                        min={1}
                        max={10}
                        step={1}
                        className="py-4"
                      />
                      <div className="text-center text-2xl font-bold">{userRating}</div>
                      <Button onClick={handleAddRating} className="w-full" size="sm">
                        Submit Rating
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Session Details */}
            <Card>
              <CardHeader>
                <CardTitle>Session Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {displayLocationLabel && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Location</div>
                      <div className="text-muted-foreground">{displayLocationLabel}</div>
                    </div>
                  </div>
                )}
                {catchData.peg_or_swim && !catchData.hide_exact_spot && (
                  <div className="flex items-start gap-2">
                    <Layers className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Peg/Swim</div>
                      <div className="text-muted-foreground">{catchData.peg_or_swim}</div>
                    </div>
                  </div>
                )}
                {catchData.hide_exact_spot && catchData.peg_or_swim && (
                  <div className="flex items-start gap-2">
                    <EyeOff className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div className="text-muted-foreground text-xs">
                      Exact peg/swim hidden by angler
                    </div>
                  </div>
                )}
                {catchData.length && (
                  <div className="flex items-start gap-2">
                    <FishIcon className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Length</div>
                      <div className="text-muted-foreground">
                        {catchData.length}{catchData.length_unit}
                      </div>
                    </div>
                  </div>
                )}
                {catchData.water_type && (
                  <div className="flex items-start gap-2">
                    <Droplets className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Water Type</div>
                      <div className="text-muted-foreground">{formatEnum(catchData.water_type)}</div>
                    </div>
                  </div>
                )}
                {catchData.time_of_day && (
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium">Time of Day</div>
                      <div className="text-muted-foreground">{formatEnum(catchData.time_of_day)}</div>
                    </div>
                  </div>
                )}
                {showGpsMap && gpsData && (
                  <div className="space-y-2">
                    <div className="font-medium">GPS Pin</div>
                    <div className="overflow-hidden rounded-lg border">
                      <iframe
                        title="Pinned fishing location"
                        src={`https://www.google.com/maps?q=${gpsData.lat},${gpsData.lng}&z=15&output=embed`}
                        width="100%"
                        height="220"
                        loading="lazy"
                        allowFullScreen
                        sandbox="allow-scripts allow-same-origin allow-popups"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {gpsData.label ?? `Dropped at ${gpsData.lat.toFixed(5)}, ${gpsData.lng.toFixed(5)}`}
                      {gpsData.accuracy ? ` (±${Math.round(gpsData.accuracy)}m)` : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tactics */}
            {(catchData.method || customMethod || catchData.bait_used || catchData.equipment_used) && (
              <Card>
                <CardHeader>
                  <CardTitle>Tactics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                {(catchData.method || customMethod) && (
                  <div>
                    <div className="font-medium">Method</div>
                    <div className="text-muted-foreground">
                      {methodLabel}
                    </div>
                  </div>
                )}
                  {catchData.bait_used && (
                    <div>
                      <div className="font-medium">Bait</div>
                      <div className="text-muted-foreground">{catchData.bait_used}</div>
                    </div>
                  )}
                  {catchData.equipment_used && (
                    <div>
                      <div className="font-medium">Equipment</div>
                      <div className="text-muted-foreground">{catchData.equipment_used}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Conditions */}
            {catchData.conditions && Object.keys(catchData.conditions as Record<string, unknown>).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Conditions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {catchData.conditions.weather && (
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-primary" />
                      <span className="font-medium">Weather:</span>
                      <span className="text-muted-foreground">{formatEnum(catchData.conditions.weather)}</span>
                    </div>
                  )}
                  {catchData.conditions.airTemp && (
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-primary" />
                      <span className="font-medium">Air Temp:</span>
                      <span className="text-muted-foreground">{catchData.conditions.airTemp}°C</span>
                    </div>
                  )}
                  {catchData.conditions.waterClarity && (
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-primary" />
                      <span className="font-medium">Water:</span>
                      <span className="text-muted-foreground">{formatEnum(catchData.conditions.waterClarity)}</span>
                    </div>
                  )}
                  {catchData.conditions.windDirection && (
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-primary" />
                      <span className="font-medium">Wind:</span>
                      <span className="text-muted-foreground">{catchData.conditions.windDirection}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tags */}
            {catchData.tags && catchData.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {catchData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      {user && user.id === ownerId && (
        <div className="container mx-auto px-4 pb-12 max-w-5xl">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-destructive">Need to remove this catch?</p>
                <p className="text-destructive/80">
                  Deleting a catch will remove its ratings, reactions, and comments permanently.
                </p>
              </div>
              <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => !deleteLoading && setDeleteDialogOpen(open)}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={deleteLoading}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleteLoading ? "Deleting…" : "Delete catch"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this catch?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Removing this log will also clear its ratings, reactions, and comments. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deleteLoading}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async (event) => {
                        event.preventDefault();
                        await handleDeleteCatch();
                      }}
                    >
                      {deleteLoading ? "Deleting…" : "Delete catch"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatchDetail;
