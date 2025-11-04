import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ProfileAvatarSection from "@/components/settings/ProfileAvatarSection";
import { isAdminUser } from "@/lib/admin";
import { Loader2, LogOut } from "lucide-react";

const PROFILE_STATUS_PLACEHOLDER = "Nothing here yet. Tell people what you fish for.";

const ProfileSettings = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [initialEmail, setInitialEmail] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [initialForm, setInitialForm] = useState<{
    username: string;
    fullName: string;
    email: string;
    bio: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    fullName: "",
    email: "",
    bio: "",
  });
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [initialAvatarPath, setInitialAvatarPath] = useState<string | null>(null);
  const [legacyAvatarUrl, setLegacyAvatarUrl] = useState<string | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      setIsLoading(true);

      const [{ data: profileData, error: profileError }, { data: authData, error: authError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("username, full_name, avatar_path, avatar_url, bio")
            .eq("id", user.id)
            .maybeSingle(),
          supabase.auth.getUser(),
        ]);

      if (profileError || authError) {
        console.error("Failed to load profile settings", profileError ?? authError);
        toast.error("Unable to load profile settings.");
        setIsLoading(false);
        return;
      }

      const email = authData?.user?.email ?? "";
      setInitialEmail(email);

      const nextForm = {
        username: profileData?.username ?? user.user_metadata?.username ?? "",
        fullName: profileData?.full_name ?? user.user_metadata?.full_name ?? "",
        email,
        bio: profileData?.bio ?? user.user_metadata?.bio ?? "",
      };

      const storedPath = profileData?.avatar_path ?? null;
      const legacyUrl = profileData?.avatar_url ?? user.user_metadata?.avatar_url ?? null;

      setFormData(nextForm);
      setInitialForm(nextForm);
      setAvatarPath(storedPath);
      setInitialAvatarPath(storedPath);
      setLegacyAvatarUrl(legacyUrl);
      setIsLoading(false);
    };

    if (user) {
      void loadProfile();
    }
  }, [user]);

  const hasChanges = useMemo(() => {
    if (!initialForm) return false;
    return (
      formData.username !== initialForm.username ||
      formData.fullName !== initialForm.fullName ||
      formData.email !== initialForm.email ||
      formData.bio !== initialForm.bio ||
      avatarPath !== initialAvatarPath
    );
  }, [formData, initialForm, avatarPath, initialAvatarPath]);

  const handleInputChange = (field: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handlePasswordInputChange =
    (field: keyof typeof passwordData) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordData((prev) => ({
        ...prev,
        [field]: event.target.value,
      }));
    };

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setProfileError(null);
    setProfileSuccess(null);
    setIsSaving(true);

    try {
      const updates = {
        username: formData.username.trim(),
        full_name: formData.fullName.trim() || null,
        avatar_path: avatarPath,
        bio: formData.bio.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateProfileError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (updateProfileError) {
        throw updateProfileError;
      }

      if (formData.email && formData.email !== initialEmail) {
        const { error: emailError } = await supabase.auth.updateUser({ email: formData.email.trim() });
        if (emailError) {
          throw emailError;
        }
        setInitialEmail(formData.email.trim());
        toast("Verification required", {
          description: "Check your inbox to confirm the new email address.",
        });
      }

      const sanitizedForm = {
        username: updates.username,
        fullName: updates.full_name ?? "",
        email: formData.email.trim(),
        bio: updates.bio ?? "",
      };

      setFormData(sanitizedForm);
      setInitialForm(sanitizedForm);
      setInitialAvatarPath(avatarPath ?? null);
      setProfileSuccess("Profile details saved successfully.");
    } catch (error) {
      console.error("Failed to save profile", error);
      setProfileError(error instanceof Error ? error.message : "Unable to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError("Please complete all password fields.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const emailForAuth = initialEmail;
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: emailForAuth,
        password: passwordData.currentPassword,
      });

      if (reauthError) {
        throw new Error("Current password is incorrect.");
      }

      const { error: passwordUpdateError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (passwordUpdateError) {
        throw passwordUpdateError;
      }

      setPasswordSuccess("Password updated successfully.");
      setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error("Failed to update password", error);
      setPasswordError(error instanceof Error ? error.message : "Unable to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/auth");
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="container mx-auto flex items-center justify-center px-4 py-16 text-slate-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading profile settings…
        </div>
      </div>
    );
  }

  const isAdmin = isAdminUser(user?.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
        <div className="space-y-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">Profile settings</h1>
              {isAdmin && <Badge variant="secondary">Admin</Badge>}
            </div>
            <p className="text-sm text-slate-600">Manage your account, avatar and security.</p>
          </div>

          {user && (
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
                <CardTitle className="text-lg">Avatar</CardTitle>
                <p className="text-sm text-slate-600">Upload a photo so other anglers can recognise you.</p>
              </CardHeader>
              <CardContent className="px-5 pb-5 md:px-8 md:pb-8">
                <ProfileAvatarSection
                  userId={user.id}
                  username={formData.username || user.user_metadata?.username || user.email || "Angler"}
                  avatarPath={avatarPath}
                  legacyAvatarUrl={legacyAvatarUrl}
                  onAvatarChange={(path) => {
                    setAvatarPath(path);
                    if (path) {
                      setLegacyAvatarUrl(null);
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}

          <form className="space-y-8" onSubmit={handleSaveProfile}>
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
                <CardTitle className="text-lg">Account</CardTitle>
                <p className="text-sm text-slate-600">Keep your public profile and contact details up to date.</p>
              </CardHeader>
              <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="username">Username</Label>
                      <p className="text-xs text-slate-500">Unique handle anglers will see on your posts.</p>
                    </div>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={handleInputChange("username")}
                      placeholder="angling_legend"
                      required
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="fullName">Full name</Label>
                      <p className="text-xs text-slate-500">Optional. Share your real name with the community.</p>
                    </div>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={handleInputChange("fullName")}
                      placeholder="Alex Rivers"
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <p className="text-xs text-slate-500">We&apos;ll send a verification link if you change this.</p>
                    </div>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange("email")}
                      placeholder="angler@example.com"
                      required
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="bio">Bio / status</Label>
                    <p className="text-xs text-slate-500">Tell anglers what you fish for or share a quick update.</p>
                  </div>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={handleInputChange("bio")}
                    placeholder={PROFILE_STATUS_PLACEHOLDER}
                    rows={4}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                  />
                </div>
                {profileError && <p className="text-sm text-red-600">{profileError}</p>}
                {profileSuccess && <p className="text-sm text-emerald-600">{profileSuccess}</p>}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <div className="text-xs text-slate-500 md:order-1">
                Changes take effect immediately after saving.
              </div>
              <Button
                type="submit"
                disabled={isSaving || !hasChanges}
                className="order-2 h-11 w-full bg-sky-600 text-white hover:bg-sky-700 md:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </form>

          <form onSubmit={handleUpdatePassword} className="space-y-6">
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
                <CardTitle className="text-lg">Security</CardTitle>
                <p className="text-sm text-slate-600">Update your password to keep your account secure.</p>
              </CardHeader>
              <CardContent className="space-y-6 px-5 pb-5 md:px-8 md:pb-8">
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3 text-xs text-slate-600">
                  Use at least 8 characters with a mix of letters, numbers, or symbols for your new password.
                </div>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="currentPassword">Current password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordInputChange("currentPassword")}
                      placeholder="••••••••"
                      required
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordInputChange("newPassword")}
                      placeholder="••••••••"
                      required
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm new password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordInputChange("confirmPassword")}
                      placeholder="••••••••"
                      required
                      className="mt-1 w-full rounded-md border border-slate-200 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-1 focus:ring-offset-white"
                    />
                  </div>
                </div>
                {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                {passwordSuccess && <p className="text-sm text-emerald-600">{passwordSuccess}</p>}
                <div className="flex justify-end">
                  <Button type="submit" disabled={isUpdatingPassword} className="h-11 w-full bg-sky-600 text-white hover:bg-sky-700 md:w-auto">
                    {isUpdatingPassword ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating…
                      </>
                    ) : (
                      "Update password"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          <Card className="rounded-xl border border-red-200 bg-red-50/70 shadow-none">
            <CardHeader className="px-5 pb-2 pt-5 md:px-8 md:pt-8 md:pb-4">
              <CardTitle className="text-base font-semibold text-red-600">Danger zone</CardTitle>
              <p className="text-sm text-red-600/80">Sign out safely or prepare to delete your account (coming soon).</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-5 pb-5 md:flex-row md:items-center md:justify-between md:px-8 md:pb-8">
              <p className="text-sm text-red-600/80 md:max-w-md">
                Leaving the session? Sign out to keep your catches and messages secure.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button variant="destructive" className="h-11 min-w-[140px]" onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </Button>
                <Button variant="outline" disabled className="h-11 border-red-300 text-red-500">
                  Delete account (coming soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
