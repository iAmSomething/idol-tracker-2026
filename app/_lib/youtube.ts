/**
 * YouTube Utility functions for the frontend
 */

/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats.
 * Returns null if the URL is invalid or the ID cannot be found.
 */
export function getYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null;
  // Handle case where Bugs MV or other invalid URLs might be passed
  if (!url.includes("youtube.com") && !url.includes("youtu.be")) return null;

  const regExp =
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * Converts any YouTube URL into an embeddable watch iframe URL.
 * Returns null if the URL is not a valid YouTube video.
 */
export function toYouTubeEmbedUrl(
  url: string | undefined | null,
): string | null {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
