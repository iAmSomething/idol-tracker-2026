/**
 * URL Guard Utilities
 * 
 * mediaLinks.musicVideo 필드에 YouTube가 아닌 URL(특히 Bugs MV URL)이
 * 유입되어 프론트엔드의 YouTube iframe embed가 깨지는 버그를 구조적으로 방지합니다.
 * 
 * 모든 스크립트와 프론트엔드에서 YouTube URL 검증이 필요할 때
 * 이 모듈을 import하여 사용해야 합니다.
 */

const YOUTUBE_REGEX = /^.*(youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^#&?]{11}).*/;

/**
 * YouTube 또는 youtu.be URL인지 검증합니다.
 * Bugs, Apple Music 등 타 도메인 URL은 false를 반환합니다.
 */
export function isYouTubeUrl(url: string | undefined | null): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}

/**
 * mediaLinks.musicVideo에 저장할 수 있는 embeddable YouTube URL인지 검증합니다.
 * 
 * ✅ 허용: https://youtube.com/watch?v=xxx, https://youtu.be/xxx
 * ❌ 거부: https://music.bugs.co.kr/mv/640283, 빈 문자열, null
 * ❌ 거부: https://www.youtube.com/results?search_query=... (검색 URL)
 */
export function isEmbeddableYouTubeUrl(url: string | undefined | null): boolean {
  if (!isYouTubeUrl(url)) return false;
  // YouTube 검색 결과 URL은 embed 불가
  if (url!.includes('results?search_query=')) return false;
  // Video ID가 추출 가능해야 embeddable
  return extractYouTubeId(url) !== null;
}

/**
 * URL에서 YouTube Video ID (11자)를 안전하게 추출합니다.
 * YouTube/youtu.be URL만 처리하며, Bugs 등 타 도메인은 항상 null을 반환합니다.
 * 
 * @example
 * extractYouTubeId('https://youtube.com/watch?v=ihvuwqlGHXs') // 'ihvuwqlGHXs'
 * extractYouTubeId('https://youtu.be/ihvuwqlGHXs') // 'ihvuwqlGHXs'
 * extractYouTubeId('https://music.bugs.co.kr/mv/640283') // null
 * extractYouTubeId(null) // null
 */
export function extractYouTubeId(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!isYouTubeUrl(url)) return null;
  
  const match = url.match(YOUTUBE_REGEX);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * YouTube embed iframe용 URL로 변환합니다.
 * YouTube가 아니거나 ID 추출 실패 시 null을 반환합니다.
 * 
 * @example
 * toYouTubeEmbedUrl('https://youtube.com/watch?v=ihvuwqlGHXs')
 * // 'https://www.youtube.com/embed/ihvuwqlGHXs'
 */
export function toYouTubeEmbedUrl(url: string | undefined | null): string | null {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

/**
 * 여러 URL 후보 중에서 첫 번째 유효한 YouTube embed URL을 찾습니다.
 * 프론트엔드 MV 렌더링 로직에서 사용합니다.
 * 
 * @example
 * findFirstEmbeddableUrl([
 *   'https://music.bugs.co.kr/mv/640283',  // ❌ 스킵
 *   'https://youtube.com/watch?v=xxx',       // ✅ 반환
 * ])
 */
export function findFirstEmbeddableUrl(urls: (string | undefined | null)[]): string | null {
  for (const url of urls) {
    const embedUrl = toYouTubeEmbedUrl(url);
    if (embedUrl) return embedUrl;
  }
  return null;
}
