import { supabase } from "@/integrations/supabase/client";

const projectUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const publicBase = projectUrl ? `${projectUrl}/storage/v1/object/public/` : "";

export const getPublicAssetUrl = (storagePath?: string | null): string | null => {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) {
    return storagePath;
  }
  if (!publicBase) return null;
  return `${publicBase}${storagePath.replace(/^\/+/, "")}`;
};

const MAX_AVATAR_SIZE_MB = 5;
const ALLOWED_MIME = /^image\//i;

export const uploadAvatarToStorage = async (
  userId: string,
  file: File,
): Promise<{ path?: string; error?: string }> => {
  if (!ALLOWED_MIME.test(file.type)) {
    return { error: "Please choose an image file." };
  }
  if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
    return { error: `Please choose an image smaller than ${MAX_AVATAR_SIZE_MB}MB.` };
  }

  const extensionFromName = file.name.split(".").pop()?.toLowerCase();
  const extensionFromType = file.type.split("/")[1];
  const extension = extensionFromName || extensionFromType || "jpg";
  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const objectPath = `${userId}/${uniqueSuffix}.${extension}`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error("Avatar upload failed", error);
    return { error: "Couldn't upload image. Try a smaller file." };
  }

  return { path: `avatars/${objectPath}` };
};

export const resolveAvatarUrl = (options: { path?: string | null; legacyUrl?: string | null }) => {
  return getPublicAssetUrl(options.path) ?? (options.legacyUrl ?? null);
};
