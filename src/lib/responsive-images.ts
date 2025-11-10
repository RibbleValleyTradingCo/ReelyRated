/**
 * Responsive images utility for Supabase storage
 *
 * Generates responsive image URLs with transformations for optimal performance.
 * Requires Supabase Pro plan for image transformations.
 *
 * @see docs/RESPONSIVE_IMAGES.md for implementation details
 */

import { env } from "./env";

export interface ImageTransform {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
  format?: "webp" | "avif";
}

export interface ResponsiveImageConfig {
  src: string;
  sizes: { width: number; descriptor: string }[];
  sizesAttr?: string;
}

/**
 * Generate Supabase storage URL with transformations
 *
 * NOTE: Requires Supabase Pro plan. On free tier, returns original URL.
 *
 * @example
 * ```typescript
 * const url = getTransformedImageUrl('avatars/user123/photo.jpg', {
 *   width: 400,
 *   quality: 85,
 *   format: 'webp'
 * });
 * // Returns: https://project.supabase.co/storage/v1/object/public/avatars/user123/photo.jpg?width=400&quality=85&format=webp
 * ```
 */
export function getTransformedImageUrl(
  storagePath: string,
  transform: ImageTransform
): string {
  // Check if path is already an absolute URL (external image or legacy)
  if (/^https?:\/\//i.test(storagePath)) {
    return storagePath;
  }

  const projectUrl = env.VITE_SUPABASE_URL.replace(/\/$/, "");
  const publicBase = `${projectUrl}/storage/v1/object/public/`;

  const params = new URLSearchParams();
  if (transform.width) params.set("width", transform.width.toString());
  if (transform.height) params.set("height", transform.height.toString());
  if (transform.quality) params.set("quality", transform.quality.toString());
  if (transform.resize) params.set("resize", transform.resize);
  if (transform.format) params.set("format", transform.format);

  const queryString = params.toString();
  const cleanPath = storagePath.replace(/^\/+/, "");

  return queryString
    ? `${publicBase}${cleanPath}?${queryString}`
    : `${publicBase}${cleanPath}`;
}

/**
 * Generate responsive srcSet for user-uploaded images
 *
 * Creates multiple image variants at different sizes for responsive loading.
 *
 * @example
 * ```typescript
 * const { src, srcSet, sizes } = getResponsiveImageSrcSet(
 *   'avatars/user123/photo.jpg',
 *   {
 *     src: 'https://...fallback.jpg',
 *     sizes: [
 *       { width: 400, descriptor: '400w' },
 *       { width: 800, descriptor: '800w' }
 *     ],
 *     sizesAttr: '(max-width: 768px) 100vw, 800px'
 *   }
 * );
 * ```
 */
export function getResponsiveImageSrcSet(
  storagePath: string,
  config: ResponsiveImageConfig
): {
  src: string;
  srcSet: string;
  sizes: string;
} {
  // If external URL, return as-is (can't transform)
  if (/^https?:\/\//i.test(storagePath)) {
    return {
      src: storagePath,
      srcSet: "",
      sizes: "100vw",
    };
  }

  // Default src (fallback for old browsers)
  const src = config.src;

  // Generate srcSet with multiple sizes
  const srcSet = config.sizes
    .map(({ width, descriptor }) => {
      const url = getTransformedImageUrl(storagePath, {
        width,
        quality: 85,
        format: "webp",
      });
      return `${url} ${descriptor}`;
    })
    .join(", ");

  const sizes = config.sizesAttr || "100vw";

  return { src, srcSet, sizes };
}

/**
 * Preset configurations for common use cases
 *
 * These match the typical display sizes in the ReelyRated app.
 */
export const IMAGE_PRESETS = {
  /**
   * Feed card images (displayed at ~800px max on desktop, full width on mobile)
   */
  feedCard: {
    sizes: [
      { width: 400, descriptor: "400w" },
      { width: 800, descriptor: "800w" },
      { width: 1200, descriptor: "1200w" },
    ],
    sizesAttr: "(max-width: 768px) 100vw, 800px",
  },

  /**
   * Thumbnail images (displayed at ~100px in leaderboards)
   */
  thumbnail: {
    sizes: [
      { width: 100, descriptor: "100w" },
      { width: 200, descriptor: "200w" },
    ],
    sizesAttr: "100px",
  },

  /**
   * Hero images (full width, max 1920px)
   */
  hero: {
    sizes: [
      { width: 800, descriptor: "800w" },
      { width: 1400, descriptor: "1400w" },
      { width: 1920, descriptor: "1920w" },
    ],
    sizesAttr: "100vw",
  },

  /**
   * Gallery thumbnails (displayed at ~160px height)
   */
  galleryThumb: {
    sizes: [
      { width: 160, descriptor: "160w" },
      { width: 320, descriptor: "320w" },
    ],
    sizesAttr: "160px",
  },

  /**
   * Avatar images (displayed at 40-80px typically)
   */
  avatar: {
    sizes: [
      { width: 80, descriptor: "80w" },
      { width: 160, descriptor: "160w" },
    ],
    sizesAttr: "80px",
  },

  /**
   * Catch detail hero image (displayed at 500px height, full width)
   */
  catchDetail: {
    sizes: [
      { width: 600, descriptor: "600w" },
      { width: 1200, descriptor: "1200w" },
      { width: 1920, descriptor: "1920w" },
    ],
    sizesAttr: "(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1200px",
  },
};

/**
 * Quick helper for catch images in feed
 *
 * Returns image props ready to spread onto an <img> element.
 *
 * @example
 * ```tsx
 * <img
 *   {...getCatchImageProps(catchItem.image_url)}
 *   alt={catchItem.title}
 *   loading="lazy"
 * />
 * ```
 */
export function getCatchImageProps(imageUrl: string | null | undefined) {
  if (!imageUrl || imageUrl.startsWith("http")) {
    // External URL or null - return as-is
    return { src: imageUrl || "" };
  }

  return getResponsiveImageSrcSet(imageUrl, {
    src: imageUrl,
    ...IMAGE_PRESETS.feedCard,
  });
}

/**
 * Quick helper for catch detail hero images
 */
export function getCatchDetailImageProps(imageUrl: string | null | undefined) {
  if (!imageUrl || imageUrl.startsWith("http")) {
    return { src: imageUrl || "" };
  }

  return getResponsiveImageSrcSet(imageUrl, {
    src: imageUrl,
    ...IMAGE_PRESETS.catchDetail,
  });
}

/**
 * Quick helper for thumbnail images (leaderboard, etc.)
 */
export function getThumbnailProps(imageUrl: string | null | undefined) {
  if (!imageUrl || imageUrl.startsWith("http")) {
    return { src: imageUrl || "" };
  }

  return getResponsiveImageSrcSet(imageUrl, {
    src: imageUrl,
    ...IMAGE_PRESETS.thumbnail,
  });
}

/**
 * Quick helper for gallery thumbnail images
 */
export function getGalleryThumbProps(imageUrl: string | null | undefined) {
  if (!imageUrl || imageUrl.startsWith("http")) {
    return { src: imageUrl || "" };
  }

  return getResponsiveImageSrcSet(imageUrl, {
    src: imageUrl,
    ...IMAGE_PRESETS.galleryThumb,
  });
}

/**
 * Quick helper for avatar images
 */
export function getAvatarImageProps(imageUrl: string | null | undefined) {
  if (!imageUrl || imageUrl.startsWith("http")) {
    return { src: imageUrl || "" };
  }

  return getResponsiveImageSrcSet(imageUrl, {
    src: imageUrl,
    ...IMAGE_PRESETS.avatar,
  });
}
