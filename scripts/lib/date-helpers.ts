/**
 * Date Helper Utilities
 * 
 * AGENTS.md §1에서 가장 치명적으로 규정한 "7일 롤링 윈도우" 로직을
 * 한 곳에서만 관리합니다. 모든 크롤러 스크립트는 이 모듈을 import하여
 * 날짜 비교를 수행해야 합니다.
 * 
 * ⚠️ 절대 금지:
 * - 특정 날짜 하드코딩 (예: "2026-07-10")
 * - todayStr 단순 비교 (어제 컴백 데이터 영구 누락 원인)
 */

const ROLLING_WINDOW_DAYS = 7;

/**
 * 현재 시점 기준 7일 전 날짜 문자열(YYYY-MM-DD)을 반환합니다.
 * 크롤러의 날짜 필터링에 사용하세요.
 * 
 * @example
 * // 오늘이 2026-07-15라면
 * getSevenDaysAgoStr() // '2026-07-08'
 */
export function getSevenDaysAgoStr(): string {
  const d = new Date(Date.now() - ROLLING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

/**
 * 오늘 날짜 문자열(YYYY-MM-DD)을 반환합니다.
 */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * releaseDate가 7일 롤링 윈도우 밖(너무 오래된 과거)인지 판별합니다.
 * true이면 스킵 대상입니다.
 * 
 * TBA이거나 TBA를 포함하는 날짜는 항상 false(스킵하지 않음)를 반환합니다.
 * 
 * @example
 * // 오늘이 2026-07-15일 때
 * isOutsideRollingWindow('2026-07-14') // false (어제 → 수집 대상!)
 * isOutsideRollingWindow('2026-07-01') // true (14일 전 → 스킵)
 * isOutsideRollingWindow('TBA')        // false (TBA → 스킵하지 않음)
 */
export function isOutsideRollingWindow(releaseDate: string | null | undefined): boolean {
  if (isTbaDate(releaseDate)) return false;
  const sevenDaysAgoStr = getSevenDaysAgoStr();
  return releaseDate! < sevenDaysAgoStr;
}

/**
 * TBA(미정) 날짜 여부를 판별합니다.
 * null, undefined, 빈 문자열, "TBA", "TBA" 포함 문자열 모두 true입니다.
 */
export function isTbaDate(releaseDate: string | null | undefined): boolean {
  if (!releaseDate) return true;
  if (releaseDate === 'TBA') return true;
  if (releaseDate.includes('TBA')) return true;
  return false;
}

/**
 * YYYY-MM-DD 형식인지 간단히 검증합니다.
 */
export function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

/**
 * 크롤러에서 사용하는 표준 날짜 필터링 로직입니다.
 * AGENTS.md §1의 7일 롤링 윈도우 + 과거형 동사 예외 처리를 통합합니다.
 * 
 * @returns true이면 이 데이터를 스킵(continue)해야 합니다.
 */
export function shouldSkipByDate(releaseDate: string | null | undefined): boolean {
  // TBA는 절대 스킵하지 않음
  if (isTbaDate(releaseDate)) return false;
  // 7일 이상 오래된 과거만 스킵
  return isOutsideRollingWindow(releaseDate);
}
