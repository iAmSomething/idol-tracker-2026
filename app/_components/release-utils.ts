import type { Comeback } from "../../types";

export function isComebackReleased(c: Partial<Comeback & { bugsAlbumId?: string }>): boolean {
  if (
    c.isReleased === true ||
    c.status === "RELEASED" ||
    c.confidenceTier === "RELEASED" ||
    (c.bugsAlbumId && c.bugsAlbumId.trim() !== "")
  ) {
    return true;
  }

  if (c.releaseDate && c.releaseDate !== "TBA" && !c.releaseDate.includes("TBA")) {
    const todayStr = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    
    // If it's a full date (YYYY-MM-DD), check if it's <= today
    if (c.releaseDate.length >= 10 && c.releaseDate <= todayStr) {
      return true;
    }
  }

  return false;
}

export function getConfidenceIcon(tier?: string, c?: Partial<Comeback>): string {
  if (c && isComebackReleased(c)) return "";
  if (tier === "RUMORED") return "🌑";
  if (tier === "ANNOUNCED") return "🌒";
  if (tier === "SCHEDULED") return "🌓";
  if (tier === "TEASING") return "🌔";
  if (tier === "IMMINENT") return "🌕";
  return "";
}
