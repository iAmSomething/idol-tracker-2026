import fetch from "node-fetch";
import * as cheerio from "cheerio";
import Innertube from "youtubei.js";

export interface StreamingLinks {
  bugs?: string;
  melon?: string;
  youtubeMusic?: string;
  appleMusic?: string;
}

export async function fetchMelonLink(artist: string, album: string): Promise<string | undefined> {
  try {
    const query = encodeURIComponent(`${artist} ${album}`);
    const url = `https://www.melon.com/search/album/index.htm?q=${query}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const firstAlbumLink = $("a.thumb").first().attr("href");
    const albumIdMatch = firstAlbumLink?.match(/javascript:melon\.link\.goAlbumDetail\('(\d+)'\)/);
    if (albumIdMatch) {
      return `https://www.melon.com/album/detail.htm?albumId=${albumIdMatch[1]}`;
    }
  } catch (e) {
    console.error("Melon fetch error:", e);
  }
  return undefined;
}

export async function fetchYouTubeMusicLink(artist: string, album: string, releaseType?: string): Promise<string | undefined> {
  try {
    const yt = await Innertube.create();
    
    if (releaseType === "single") {
      const results = await yt.music.search(`${artist} ${album}`, { type: 'song' });
      const firstResult = results.songs?.contents?.[0] as any;
      if (firstResult && firstResult.id) {
        return `https://music.youtube.com/watch?v=${firstResult.id}`;
      }
    }

    const results = await yt.music.search(`${artist} ${album}`, { type: 'album' });
    const firstResult = results.albums?.contents?.[0] as any;
    if (firstResult && firstResult.endpoint?.payload?.browseId) {
      return `https://music.youtube.com/browse/${firstResult.endpoint.payload.browseId}`;
    }

    // Fallback: If album search failed (or it wasn't marked single but acts like one)
    if (!firstResult) {
      const fallbackResults = await yt.music.search(`${artist} ${album}`, { type: 'song' });
      const firstFallback = fallbackResults.songs?.contents?.[0] as any;
      if (firstFallback && firstFallback.id) {
        return `https://music.youtube.com/watch?v=${firstFallback.id}`;
      }
    }
  } catch (e) {
    console.error("YT Music fetch error:", e);
  }
  return undefined;
}

export async function fetchAppleMusicLink(artist: string, album: string): Promise<string | undefined> {
  try {
    const query = encodeURIComponent(`${artist} ${album}`);
    const url = `https://itunes.apple.com/search?term=${query}&entity=album&country=KR&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].collectionViewUrl;
    }
  } catch (e) {
    console.error("Apple Music fetch error:", e);
  }
  return undefined;
}

export async function fetchAllStreamingLinks(artist: string, album: string, existingBugsLink?: string, releaseType?: string): Promise<StreamingLinks> {
  const links: StreamingLinks = {};
  if (existingBugsLink) links.bugs = existingBugsLink;
  
  const [melon, yt, apple] = await Promise.all([
    fetchMelonLink(artist, album),
    fetchYouTubeMusicLink(artist, album, releaseType),
    fetchAppleMusicLink(artist, album)
  ]);

  if (melon) links.melon = melon;
  if (yt) links.youtubeMusic = yt;
  if (apple) links.appleMusic = apple;

  return links;
}

export async function fetchMelonTrackLink(artist: string, trackName: string): Promise<string | undefined> {
  try {
    const query = encodeURIComponent(`${artist} ${trackName}`);
    const url = `https://www.melon.com/search/song/index.htm?q=${query}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" } });
    const html = await res.text();
    const $ = cheerio.load(html);
    const songIdMatch = $("a.btn_icon_detail").first().attr("href")?.match(/javascript:searchLog\('web_song','[^']+','[^']+','(\d+)'/);
    // Alternatively fallback to melon.link.goSongDetail
    const fallbackMatch = $("a.btn_icon_detail").first().attr("href")?.match(/javascript:melon\.link\.goSongDetail\('(\d+)'\)/);
    
    const finalId = (songIdMatch && songIdMatch[1]) || (fallbackMatch && fallbackMatch[1]);
    if (finalId) {
      return `https://www.melon.com/song/detail.htm?songId=${finalId}`;
    }
  } catch (e) {
    console.error("Melon Track fetch error:", e);
  }
  return undefined;
}

export async function fetchYouTubeMusicTrackLink(artist: string, trackName: string): Promise<string | undefined> {
  try {
    const yt = await Innertube.create();
    const query = `${artist} ${trackName}`;
    
    // 1. Try 'song' search
    let results = await yt.music.search(query, { type: 'song' });
    let firstResult = results.songs?.contents?.[0] as any;
    if (firstResult && firstResult.id) {
      return `https://music.youtube.com/watch?v=${firstResult.id}`;
    }
    
    // 2. Fallback to 'video' search
    results = await yt.music.search(query, { type: 'video' });
    firstResult = results.videos?.contents?.[0] as any;
    if (firstResult && firstResult.id) {
      return `https://music.youtube.com/watch?v=${firstResult.id}`;
    }
  } catch (e) {
    console.error("YT Music Track fetch error:", e);
  }
  return undefined;
}

export async function fetchAppleMusicTrackLink(artist: string, trackName: string): Promise<string | undefined> {
  try {
    const query = encodeURIComponent(`${artist} ${trackName}`);
    const url = `https://itunes.apple.com/search?term=${query}&entity=song&country=KR&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].trackViewUrl;
    }
  } catch (e) {
    console.error("Apple Music Track fetch error:", e);
  }
  return undefined;
}

export async function fetchAllStreamingLinksForTrack(artist: string, trackName: string, existingBugsLink?: string): Promise<StreamingLinks> {
  const links: StreamingLinks = {};
  if (existingBugsLink) links.bugs = existingBugsLink;
  
  const [melon, yt, apple] = await Promise.all([
    fetchMelonTrackLink(artist, trackName),
    fetchYouTubeMusicTrackLink(artist, trackName),
    fetchAppleMusicTrackLink(artist, trackName)
  ]);

  if (melon) links.melon = melon;
  if (yt) links.youtubeMusic = yt;
  if (apple) links.appleMusic = apple;

  return links;
}

