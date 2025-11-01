import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Trophy, Fish, Users as UsersIcon, BarChart3, Camera, Loader2 } from "lucide-react";
import { getFreshwaterSpeciesLabel } from "@/lib/freshwater-data";
import { createNotification } from "@/lib/notifications";

interface Profile {
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

interface Catch {
  id: string;
  title: string;
  image_url: string;
  ratings: { rating: number }[];
  weight: number | null;
  weight_unit: string | null;
  species: string | null;
  created_at: string;
}

interface FollowingProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

const Profile = () => {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [catches, setCatches] = useState<Catch[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingProfiles, setFollowingProfiles] = useState<FollowingProfile[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const isOwnProfile = user?.id === userId;

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      toast.error("Failed to load profile");
    } else {
      setProfile(data);
      setEditedBio(data.bio || "");
    }
    setIsLoading(false);
  }, [userId]);

  const fetchUserCatches = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("catches")
      .select("id, title, image_url, weight, weight_unit, species, created_at, ratings (rating)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCatches(data);
    }
  }, [userId]);

  const fetchFollowers = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from("profiles_followers")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId);

    if (!error && count !== null) {
      setFollowersCount(count);
    }
  }, [userId]);

  const fetchFollowingProfiles = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("profiles_followers")
      .select(
        `
          followed_profile:profiles!profiles_followers_following_id_fkey (
            id,
            username,
            avatar_url,
            bio
          )
        `
      )
      .eq("follower_id", userId);

    if (!error && data) {
      const parsed = (data as { followed_profile: FollowingProfile | null }[])
        .map((row) => row.followed_profile)
        .filter((profileRow): profileRow is FollowingProfile => !!profileRow);
      setFollowingProfiles(parsed);
    }
  }, [userId]);

  const fetchFollowStatus = useCallback(async () => {
    if (!userId || !user || user.id === userId) return;
    const { data, error } = await supabase
      .from("profiles_followers")
      .select("id")
      .eq("follower_id", user.id)
      .eq("following_id", userId)
      .maybeSingle();

    if (!error) {
      setIsFollowing(!!data);
    }
  }, [userId, user]);

  useEffect(() => {
    void fetchProfile();
    void fetchUserCatches();
    void fetchFollowers();
    void fetchFollowingProfiles();
  }, [fetchProfile, fetchUserCatches, fetchFollowers, fetchFollowingProfiles]);

  useEffect(() => {
    if (!userId || !user || user.id === userId) {
      setIsFollowing(false);
      return;
    }
    void fetchFollowStatus();
  }, [userId, user, fetchFollowStatus]);

  const handleToggleFollow = async () => {
    if (!user || !userId) {
      toast.error("Sign in to follow anglers");
      navigate("/auth");
      return;
    }
    if (user.id === userId) return;

    setFollowLoading(true);

    if (isFollowing) {
      const { error } = await supabase
        .from("profiles_followers")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId);

      if (error) {
        toast.error("Failed to unfollow");
      } else {
        setIsFollowing(false);
        setFollowersCount((count) => Math.max(0, count - 1));
      }
    } else {
      const { error } = await supabase.from("profiles_followers").insert({
        follower_id: user.id,
        following_id: userId,
      });

      if (error) {
        toast.error("Failed to follow");
      } else {
        setIsFollowing(true);
        setFollowersCount((count) => count + 1);
        void createNotification({
          userId,
          type: "new_follower",
          data: {
            actor_id: user.id,
            message: `${user.user_metadata?.username ?? user.email ?? "Someone"} started following you.`,
          },
        });
      }
    }

    setFollowLoading(false);
  };

  const handleUpdateBio = async () => {
    if (!user || !isOwnProfile) return;

    const { error } = await supabase
      .from("profiles")
      .update({ bio: editedBio })
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to update bio");
    } else {
      toast.success("Bio updated!");
      setIsEditing(false);
      fetchProfile();
    }
  };

  const calculateAverageRating = (ratings: { rating: number }[]) => {
    if (ratings.length === 0) return "-";
    const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
    return (sum / ratings.length).toFixed(1);
  };

  const overallStats = useMemo(() => {
    const total = catches.length;
    const allRatings = catches.flatMap((catchItem) => catchItem.ratings.map((r) => r.rating));
    const avgRating = allRatings.length > 0 ? (allRatings.reduce((acc, rating) => acc + rating, 0) / allRatings.length).toFixed(1) : "-";

    const heaviestCatch = catches
      .filter((catchItem) => catchItem.weight !== null)
      .reduce<Catch | null>((prev, curr) => {
        if (!prev) return curr;
        if (!prev.weight) return curr;
        if (!curr.weight) return prev;
        return curr.weight > prev.weight ? curr : prev;
      }, null);

    const speciesCount = new Map<string, number>();
    catches.forEach((catchItem) => {
      if (catchItem.species) {
        speciesCount.set(catchItem.species, (speciesCount.get(catchItem.species) ?? 0) + 1);
      }
    });
    const topSpeciesEntry = Array.from(speciesCount.entries()).sort((a, b) => b[1] - a[1])[0];

    const latestCatch = catches[0] ?? null;

    return {
      total,
      avgRating,
      heaviestCatch,
      topSpecies: topSpeciesEntry ? { species: topSpeciesEntry[0], count: topSpeciesEntry[1] } : null,
      latestCatch,
      followingCount: followingProfiles.length,
    };
  }, [catches, followingProfiles.length]);

const formatWeight = (weight: number | null, unit: string | null) => {
  if (!weight) return "-";
  return `${weight}${unit === "kg" ? "kg" : "lb"}`;
};

  const formatSpecies = (species: string | null) => {
    if (!species) return "-";
    return getFreshwaterSpeciesLabel(species) ?? species.replace(/_/g, " ");
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !isOwnProfile) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSizeMb = 5;
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(`Please choose an image smaller than ${maxSizeMb}MB.`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const extFromName = file.name.split(".").pop()?.toLowerCase();
      const extFromType = file.type.split("/")[1];
      const extension = extFromName || extFromType || "jpg";
      const fileName = `${user.id}/${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) {
        throw updateError;
      }

      toast.success("Profile photo updated!");
      setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
    } catch (error) {
      console.error("Avatar upload failed", error);
      toast.error("Couldn't update profile photo. Please try again.");
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = "";
      }
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted">
        <Navbar />
        <div className="container mx-auto px-4 py-8">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-8 border-none bg-transparent shadow-none">
          <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-slate-900 text-white shadow-2xl">
            <div className="absolute -top-32 right-1/3 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
            <div className="absolute top-12 left-8 hidden h-32 w-32 rounded-full bg-secondary/30 blur-2xl md:block" />
            <div className="absolute bottom-0 right-0 hidden h-40 w-40 translate-x-1/3 translate-y-1/3 rounded-full bg-primary/50 blur-3xl md:block" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.2)_0%,_rgba(15,23,42,0.9)_45%,_rgba(10,12,15,0.95)_100%)]" />
            <CardContent className="relative z-10 px-6 py-8 md:px-12 md:py-10">
              <div className="grid gap-8 md:grid-cols-[auto,1fr,auto] md:items-center">
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-32 w-32 border-4 border-white/70 shadow-2xl">
                    <AvatarImage src={profile.avatar_url || ""} />
                    <AvatarFallback className="text-2xl">
                      {profile.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {isOwnProfile && (
                    <>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-2 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur"
                        onClick={() => avatarInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                      >
                        {isUploadingAvatar ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                        {isUploadingAvatar ? "Uploading…" : "Update photo"}
                      </Button>
                    </>
                  )}
                </div>
                <div className="text-center md:text-left">
                  <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start">
                    <span className="rounded-full border border-white/40 bg-white/10 px-4 py-1 text-xs uppercase tracking-wide text-white/90 backdrop-blur">
                      {isOwnProfile ? "Your angler profile" : "Angler spotlight"}
                    </span>
                  </div>
                  <h1 className="mt-4 text-3xl font-bold text-white md:text-4xl drop-shadow-sm">{profile.username}</h1>
                  {isEditing && isOwnProfile ? (
                    <div className="mt-4 space-y-3">
                      <Textarea
                        value={editedBio}
                        onChange={(e) => setEditedBio(e.target.value)}
                        placeholder="Tell us about yourself..."
                        rows={3}
                        className="bg-white/90 text-foreground"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleUpdateBio}>
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="mt-4 text-base text-white/85">
                        {profile.bio || "No bio yet – share your fishing story and favourite waters."}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                        {isOwnProfile ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="rounded-full bg-white/20 text-white hover:bg-white/30"
                              onClick={() => setIsEditing(true)}
                            >
                              Edit bio
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full border-transparent bg-white/90 text-slate-900 hover:bg-white"
                              asChild
                            >
                              <Link to="/insights">View my stats</Link>
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant={isFollowing ? "secondary" : "ocean"}
                            className="rounded-full"
                            onClick={handleToggleFollow}
                            disabled={followLoading}
                          >
                            {followLoading ? "Updating…" : isFollowing ? "Following" : "Follow angler"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full border-transparent bg-white/90 text-slate-900 hover:bg-white"
                          onClick={() => navigate("/feed")}
                        >
                          View community feed
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-4 text-center md:text-right">
                  <div className="rounded-2xl border border-white/30 bg-white/10 px-5 py-4 text-white backdrop-blur">
                    <p className="text-xs uppercase tracking-wide text-white/70">Total catches</p>
                    <p className="text-3xl font-bold">{catches.length}</p>
                  </div>
                  <div className="rounded-2xl border border-white/30 bg-white/10 px-5 py-4 text-white backdrop-blur">
                    <p className="text-xs uppercase tracking-wide text-white/70">Followers</p>
                    <p className="text-2xl font-semibold">{followersCount}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        <Card className="mb-8">
          <CardContent className="py-6">
            <h2 className="text-xl font-semibold mb-4">Angler stats</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Fish className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Total catches</p>
                    <p className="text-2xl font-bold">{overallStats.total}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Average rating</p>
                    <p className="text-2xl font-bold">{overallStats.avgRating}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Heaviest catch</p>
                    <p className="text-2xl font-bold">
                      {overallStats.heaviestCatch
                        ? formatWeight(overallStats.heaviestCatch.weight, overallStats.heaviestCatch.weight_unit)
                        : "-"}
                    </p>
                    {overallStats.heaviestCatch?.species && (
                      <p className="text-xs text-muted-foreground">
                        {formatSpecies(overallStats.heaviestCatch.species)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <UsersIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Following</p>
                    <p className="text-2xl font-bold">{overallStats.followingCount}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Top species</p>
                <p className="text-lg font-semibold">
                  {overallStats.topSpecies
                    ? `${formatSpecies(overallStats.topSpecies.species)} (${overallStats.topSpecies.count})`
                    : "No catches yet"}
                </p>
              </div>
              <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Followers</p>
                <p className="text-lg font-semibold">{followersCount}</p>
              </div>
            </div>
            {overallStats.latestCatch && (
              <div className="mt-6 flex flex-col sm:flex-row gap-4 rounded-xl border border-border/60 bg-card/60 p-4">
                <img
                  src={
                    overallStats.latestCatch.image_url ||
                    "https://via.placeholder.com/400x300.png?text=Catch"
                  }
                  alt={overallStats.latestCatch.title}
                  className="h-32 w-full sm:w-48 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Latest catch</p>
                  <h3 className="text-lg font-semibold text-foreground">{overallStats.latestCatch.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    Logged {new Date(overallStats.latestCatch.created_at).toLocaleDateString("en-GB")}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      Weight{" "}
                      <span className="font-semibold text-foreground">
                        {formatWeight(overallStats.latestCatch.weight, overallStats.latestCatch.weight_unit)}
                      </span>
                    </span>
                    {overallStats.latestCatch.species && (
                      <span>
                        Species{" "}
                        <span className="font-semibold text-foreground">
                          {formatSpecies(overallStats.latestCatch.species)}
                        </span>
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-primary"
                      onClick={() => navigate(`/catch/${overallStats.latestCatch?.id}`)}
                    >
                      View catch
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-8 border-none bg-transparent shadow-none">
          <CardContent className="relative overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background/80 via-background/70 to-muted/60 px-6 py-6 md:px-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">
                {isOwnProfile ? "Anglers you follow" : `${profile.username} follows`}
              </h2>
              {isOwnProfile && followingProfiles.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {followingProfiles.length} angler{followingProfiles.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {followingProfiles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {followingProfiles.map((angler) => (
                  <Link
                    key={angler.id}
                    to={`/profile/${angler.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-card/80 p-4 transition hover:-translate-y-1 hover:border-primary hover:shadow-xl"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={angler.avatar_url || ""} />
                      <AvatarFallback>{angler.username[0]?.toUpperCase() ?? "A"}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">{angler.username}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {angler.bio || "No bio yet"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-border/50 bg-card/60 p-6 text-sm text-muted-foreground text-center">
                {isOwnProfile
                  ? "You’re not following any anglers yet. Explore the feed to find your next inspiration."
                  : `${profile.username} isn’t following anyone yet.`}
              </p>
            )}
          </CardContent>
        </Card>

        <h2 className="text-2xl font-bold mb-6">
          {isOwnProfile ? "Your Catches" : `${profile.username}'s Catches`}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {catches.map((catchItem) => (
            <Card
              key={catchItem.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/catch/${catchItem.id}`)}
            >
              <CardContent className="p-0">
                <img
                  src={catchItem.image_url}
                  alt={catchItem.title}
                  className="w-full h-48 object-cover rounded-t-lg"
                />
                <div className="p-4">
                  <h3 className="font-semibold mb-2">{catchItem.title}</h3>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-accent" />
                    <span className="text-sm font-medium">
                      {calculateAverageRating(catchItem.ratings)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {catches.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No catches yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
