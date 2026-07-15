/**
 * Artist Alias Resolver
 * 
 * AGENTS.md §4에 명시된 "데이터 파편화 방지 및 Alias 매핑 로직"을
 * 중앙화한 모듈입니다.
 * 
 * 크롤러에서 추출된 아티스트명이 DB의 기존 artists 컬렉션에 이미
 * 존재하는지 검증하고, 존재한다면 기존 artistId/artistName을
 * 반환하여 중복 생성을 방지합니다.
 */

export interface ArtistMatchCandidate {
  id: string;
  nameKo: string;
  nameEn: string;
  aliases: string[];
  displayName: string; // 정규화된 대표 이름
}

/**
 * 기획사명, 오탐 단어 등 절대로 아티스트로 등록되면 안 되는 블록리스트.
 */
export const ARTIST_BLOCKLIST = new Set([
  'sm', 'jyp', 'yg', 'hybe', 'bighit', 'starship', 'pledis', 'cube',
  'fnc', 'ist', 'rbw', 'woollim', 'dsp', 'mld', 'kq', 'ador',
  'belift', 'source music', 'sourcemusic', 'kakao', 'cj', 'cjenm',
  'warner', 'universal', 'sony', 'atlantic', 'republic',
  '기획사', '엔터', '엔터테인먼트', 'entertainment', 'records',
  'music', 'studio', 'productions', 'media',
  // 기타 명백한 오탐
  '아이돌', 'idol', 'kpop', '컴백', '데뷔', '신곡',
]);

/**
 * 문자열을 정규화합니다: 공백 제거, 소문자 변환, 괄호 내용 제거.
 */
function normalize(str: string): string {
  return str
    .replace(/\s*\(.*?\)\s*/g, '') // 괄호 제거: "8TURN(에잇턴)" -> "8TURN"
    .replace(/\s+/g, '')           // 공백 제거
    .toLowerCase();
}

/**
 * 블록리스트에 포함된 이름인지 확인합니다.
 */
export function isBlocklisted(name: string): boolean {
  return ARTIST_BLOCKLIST.has(normalize(name));
}

/**
 * 크롤러에서 추출된 아티스트명을 기존 DB 아티스트 목록과 대조합니다.
 * 
 * 공백 제거 + 소문자 변환 + 괄호 제거 후 비교하여
 * name.ko, name.en, aliases 중 하나라도 매칭되면
 * 기존 문서의 ID와 정규 이름을 반환합니다.
 * 
 * @param rawName 크롤러에서 추출된 아티스트명 (예: "DAILY:DIRECTION", "아이덴티티")
 * @param candidates DB에서 가져온 아티스트 목록
 * @returns 매칭된 아티스트 정보 또는 null
 * 
 * @example
 * resolveAlias("디렉션(D:D)", candidates)
 * // { id: "abc123", displayName: "DAILY:DIRECTION" }
 * 
 * resolveAlias("SM", candidates)
 * // null (블록리스트에 의해 차단됨)
 */
export function resolveAlias(
  rawName: string,
  candidates: ArtistMatchCandidate[]
): { id: string; displayName: string } | null {
  // 블록리스트 체크
  if (isBlocklisted(rawName)) return null;
  
  const normalizedRaw = normalize(rawName);
  if (normalizedRaw.length < 2) return null;

  for (const candidate of candidates) {
    // name.ko 비교
    if (normalize(candidate.nameKo) === normalizedRaw) {
      return { id: candidate.id, displayName: candidate.displayName };
    }
    
    // name.en 비교
    if (normalize(candidate.nameEn) === normalizedRaw) {
      return { id: candidate.id, displayName: candidate.displayName };
    }
    
    // aliases 배열 비교
    for (const alias of candidate.aliases) {
      if (normalize(alias) === normalizedRaw) {
        return { id: candidate.id, displayName: candidate.displayName };
      }
    }
    
    // 부분 포함 비교 (예: "8TURN" vs "8TURN(에잇턴)")
    const normalizedKo = normalize(candidate.nameKo);
    const normalizedEn = normalize(candidate.nameEn);
    
    if (
      (normalizedRaw.length >= 3 && normalizedKo.includes(normalizedRaw)) ||
      (normalizedRaw.length >= 3 && normalizedRaw.includes(normalizedKo) && normalizedKo.length >= 3) ||
      (normalizedRaw.length >= 3 && normalizedEn.includes(normalizedRaw)) ||
      (normalizedRaw.length >= 3 && normalizedRaw.includes(normalizedEn) && normalizedEn.length >= 3)
    ) {
      return { id: candidate.id, displayName: candidate.displayName };
    }
  }
  
  return null;
}

/**
 * Firestore artists 컬렉션 문서를 ArtistMatchCandidate로 변환합니다.
 */
export function toMatchCandidate(doc: { id: string; data: Record<string, unknown> }): ArtistMatchCandidate {
  const name = doc.data.name as { ko?: string; en?: string; aliases?: string[] } | undefined;
  return {
    id: doc.id,
    nameKo: name?.ko || '',
    nameEn: name?.en || '',
    aliases: name?.aliases || [],
    displayName: name?.ko || name?.en || doc.id,
  };
}
