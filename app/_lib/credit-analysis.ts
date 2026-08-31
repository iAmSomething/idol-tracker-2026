import type { Track } from "../../types";

/**
 * 협업 아티스트 통계 결과 인터페이스
 */
export interface CollaboratorStat {
  /** 아티스트 이름 */
  artistName: string;
  /** 함께 작업한 곡 수 */
  count: number;
  /** 아티스트 ID (존재하는 경우) */
  artistId?: string;
}

/**
 * 연관 창작자(프로듀서/작곡가/작사가) 통계 결과 인터페이스
 */
export interface RelatedComposerStat {
  /** 연관 작곡가/작사가 이름 */
  composerName: string;
  /** 함께 작업한 곡 수 */
  count: number;
}

/**
 * 프로듀서 작업물 종합 통계 인터페이스
 */
export interface ComposerOverviewStats {
  /** 총 참여 곡 수 */
  totalTracks: number;
  /** 타이틀 곡 참여 수 */
  titleTracksCount: number;
  /** 함께 작업한 고유 아티스트 수 */
  uniqueArtistsCount: number;
}

/**
 * 특정 창작자의 곡 목록에서 가장 많이 협업한 아티스트 상위 N명을 추출합니다.
 *
 * [Side-effect Free / Pure Function]
 * 이 함수는 외부 상태나 DB를 변경하지 않고 전달받은 메모리 상의 배열만을 연산합니다.
 *
 * @param tracks 분석할 곡 목록 배열
 * @param limit 반환할 최대 아티스트 수 (기본값: 3)
 * @returns 빈도순으로 내림차순 정렬된 협업 아티스트 목록
 *
 * @example
 * const topArtists = getTopCollaborators(tracks, 3);
 * // [{ artistName: "aespa", count: 5 }, { artistName: "NCT 127", count: 3 }, ...]
 */
export function getTopCollaborators(
  tracks: Track[],
  limit: number = 3,
): CollaboratorStat[] {
  if (!tracks || tracks.length === 0) {
    return [];
  }

  const statMap = new Map<string, { count: number; artistId?: string }>();

  for (const track of tracks) {
    const rawName = track.artistName?.trim() || "아티스트 미상";
    if (!rawName) continue;

    const existing = statMap.get(rawName);
    if (existing) {
      existing.count += 1;
    } else {
      statMap.set(rawName, {
        count: 1,
        artistId: track.artistId || undefined,
      });
    }
  }

  const sorted = Array.from(statMap.entries())
    .map(([artistName, { count, artistId }]) => ({
      artistName,
      count,
      artistId,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.artistName.localeCompare(b.artistName);
    });

  return sorted.slice(0, Math.max(0, limit));
}

/**
 * 특정 프로듀서(작곡가)와 함께 공동 작업(작곡/작사/편곡)한 빈도가 높은 연관 창작자를 추출합니다.
 *
 * [Side-effect Free / Pure Function]
 * 대상 창작자 본인은 결과에서 제외하며 대소문자 및 공백을 정규화하여 집계합니다.
 *
 * @param tracks 분석할 곡 목록 배열
 * @param targetComposer 기준이 되는 프로듀서/작곡가 이름 (결과에서 제외됨)
 * @param limit 반환할 최대 연관 창작자 수 (기본값: 5)
 * @returns 공동 작업 횟수 기준 내림차순 정렬된 연관 창작자 목록
 *
 * @example
 * const related = getRelatedComposers(tracks, "KENZIE", 5);
 * // [{ composerName: "LDN Noise", count: 4 }, { composerName: "Adrian McKinnon", count: 2 }, ...]
 */
export function getRelatedComposers(
  tracks: Track[],
  targetComposer: string,
  limit: number = 5,
): RelatedComposerStat[] {
  if (!tracks || tracks.length === 0 || !targetComposer?.trim()) {
    return [];
  }

  const targetNormalized = targetComposer.trim().toLowerCase();
  const statMap = new Map<string, { displayName: string; count: number }>();

  for (const track of tracks) {
    // 공동 작곡가 및 작사가 모두 공동 창작자로 집계
    const collaborators = new Set<string>();

    if (Array.isArray(track.composers)) {
      track.composers.forEach((c) => {
        if (c && typeof c === "string" && c.trim()) {
          collaborators.add(c.trim());
        }
      });
    }

    if (Array.isArray(track.lyricists)) {
      track.lyricists.forEach((l) => {
        if (l && typeof l === "string" && l.trim()) {
          collaborators.add(l.trim());
        }
      });
    }

    for (const collabName of collaborators) {
      const normalized = collabName.toLowerCase();
      // 자기 자신은 제외
      if (normalized === targetNormalized) {
        continue;
      }

      const existing = statMap.get(normalized);
      if (existing) {
        existing.count += 1;
      } else {
        statMap.set(normalized, { displayName: collabName, count: 1 });
      }
    }
  }

  const sorted = Array.from(statMap.values())
    .map(({ displayName, count }) => ({
      composerName: displayName,
      count,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.composerName.localeCompare(b.composerName);
    });

  return sorted.slice(0, Math.max(0, limit));
}

/**
 * 프로듀서 참여 곡 목록에 대한 종합 통계(총 곡 수, 타이틀 곡 수, 참여 아티스트 수)를 계산합니다.
 *
 * [Side-effect Free / Pure Function]
 *
 * @param tracks 분석할 곡 목록 배열
 * @returns 종합 통계 객체
 */
export function getComposerOverviewStats(
  tracks: Track[],
): ComposerOverviewStats {
  if (!tracks || tracks.length === 0) {
    return {
      totalTracks: 0,
      titleTracksCount: 0,
      uniqueArtistsCount: 0,
    };
  }

  let titleTracksCount = 0;
  const uniqueArtists = new Set<string>();

  for (const track of tracks) {
    if (track.isTitle) {
      titleTracksCount += 1;
    }
    const artistName = track.artistName?.trim();
    if (artistName) {
      uniqueArtists.add(artistName.toLowerCase());
    }
  }

  return {
    totalTracks: tracks.length,
    titleTracksCount,
    uniqueArtistsCount: uniqueArtists.size,
  };
}
