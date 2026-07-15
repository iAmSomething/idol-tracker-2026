/**
 * youtube_scraper.ts
 * 
 * YouTube Community 탭에서 아티스트의 공식 컴백 정보를 교차 검증하고 데이터를 보강하는 헬퍼 모듈.
 * 
 * 정책:
 * - Artist DB에 official youtube link가 있으면 우선 사용
 * - 없으면 yt-search로 폴백 검색
 * - 커뮤니티 포스트는 7일 이내의 것만 필터링
 * - LLM 사용 금지: 순수 정규식으로 날짜/앨범명/타입 추출
 */

import { Innertube } from "youtubei.js";
import ytSearch from "yt-search";
import { logger } from "./logger";

export interface YouTubeExtractedInfo {
  title?: string;        // 앨범/싱글 타이틀
  releaseDate?: string;  // YYYY-MM-DD
  releaseType?: string;  // mini | full | single
  albumCoverUrl?: string; // 컨셉 포토나 커버 이미지
}

/**
 * Artist DB의 official youtube URL 또는 yt-search 폴백을 통해 채널 ID를 획득한다.
 */
async function resolveChannelId(
  youtube: InstanceType<typeof Innertube>,
  artistName: string,
  officialYoutubeUrl?: string
): Promise<string | null> {
  // 1. Official URL이 있으면 우선 사용
  if (officialYoutubeUrl) {
    try {
      const resolved = await youtube.resolveURL(officialYoutubeUrl);
      if (resolved?.payload?.browseId) {
        logger.info(`[YT] Resolved official URL for ${artistName}: ${resolved.payload.browseId}`);
        return resolved.payload.browseId;
      }
    } catch (e: any) {
      logger.error(`[YT] Failed to resolve official URL ${officialYoutubeUrl}: ${e.message}`);
    }
  }

  // 2. 폴백: yt-search로 채널 검색
  try {
    const searchResult = await ytSearch(artistName);
    const channels = searchResult.channels;
    if (channels.length === 0) {
      logger.info(`[YT] No channels found for ${artistName}`);
      return null;
    }

    const officialChannel = channels[0];
    logger.info(`[YT] Found channel via search: ${officialChannel.name} (${officialChannel.url})`);

    const resolved = await youtube.resolveURL(officialChannel.url);
    if (resolved?.payload?.browseId) {
      return resolved.payload.browseId;
    }
  } catch (e: any) {
    logger.error(`[YT] yt-search fallback failed for ${artistName}: ${e.message}`);
  }

  return null;
}

/**
 * 콘서트/이벤트/팬미팅 등 컴백과 무관한 포스트를 걸러내는 블랙리스트 키워드
 */
const NON_COMEBACK_KEYWORDS = /\b(LIVE|CONCERT|TOUR|ANNIVERSARY|FAN\s*MEETING|FANMEETING|팬미팅|콘서트|투어|라이브|공연|EXHIBITION|전시|SUPER\s*SHOW|WORLD\s*TOUR|ENCORE|앙코르|OST|사운드트랙|SOUNDTRACK)\b/i;

/**
 * 커뮤니티 포스트 텍스트에서 앨범명, 발매일, 발매 타입을 정규식으로 추출한다.
 */
function extractInfoFromPost(text: string, artistName?: string, channelName?: string): YouTubeExtractedInfo {
  const result: YouTubeExtractedInfo = {};

  // 콘서트/이벤트 포스트는 즉시 스킵
  if (NON_COMEBACK_KEYWORDS.test(text)) {
    return result;
  }

  // 아티스트명/채널명 매칭용 이름 목록
  const nameVariants = [artistName, channelName].filter(Boolean) as string[];

  // 1. 날짜 추출 (다양한 포맷 지원)
  // Format: 2026.07.16, 2026-07-16, 2026/07/16
  const isoDateMatch = text.match(/20\d{2}[.\-/](0[1-9]|1[0-2])[.\-/](0[1-9]|[12]\d|3[01])/);
  if (isoDateMatch) {
    const raw = isoDateMatch[0];
    const parts = raw.split(/[.\-/]/);
    result.releaseDate = `${parts[0]}-${parts[1]}-${parts[2]}`;
  }
  
  // Format: 7월 16일
  if (!result.releaseDate) {
    const korDateMatch = text.match(/(\d{1,2})월\s*(\d{1,2})일/);
    if (korDateMatch) {
      const year = new Date().getFullYear();
      result.releaseDate = `${year}-${korDateMatch[1].padStart(2, '0')}-${korDateMatch[2].padStart(2, '0')}`;
    }
  }

  // 2. 앨범 타입 추출
  const typeMatch = text.match(/(미니\s*\d*\s*집|정규\s*\d*\s*집|싱글|디지털\s*싱글|Single|Mini\s*Album|Full\s*Album|EP|1st\s*Single|2nd\s*Single|\d+(?:st|nd|rd|th)\s+(?:Single|Mini|Full)\s*(?:Album)?)/i);
  if (typeMatch) {
    const t = typeMatch[1].toLowerCase();
    if (t.includes('미니') || t.includes('mini') || t.includes('ep')) result.releaseType = 'mini';
    else if (t.includes('정규') || t.includes('full')) result.releaseType = 'full';
    else if (t.includes('싱글') || t.includes('single')) result.releaseType = 'single';
  }

  // 3. 앨범 타이틀 추출
  // 패턴 1: 큰따옴표/작은따옴표/꺾쇠 안의 텍스트 (가장 신뢰도 높음)
  const quotedMatch = text.match(/[''""「『《⟨\[]\s*([^''""」』》⟩\]]{1,40})\s*[''""」』》⟩\]]/);
  if (quotedMatch && quotedMatch[1].trim().length > 0) {
    const candidate = quotedMatch[1].trim();
    // 해시태그나 날짜가 아닌지 확인
    if (!candidate.match(/^\d{4}/) && !candidate.startsWith('#')) {
      // 아티스트명과 동일한 텍스트는 앨범명이 아님
      if (!nameVariants.some(n => isSimilarToArtistName(candidate, n))) {
        result.title = candidate;
      }
    }
  }
  
  // 패턴 2: 유니코드 장식 문자 (𝔹𝕆𝔻𝕐 𝕎𝔸𝕍𝔼 같은 공식 포스트 스타일)
  if (!result.title) {
    const unicodeMatch = text.match(/[⎮|]\s*([^\n]{2,30})\n/);
    if (unicodeMatch) {
      const candidate = unicodeMatch[1].trim();
      if (candidate.length > 1 && 
          !candidate.match(/^(Concept|Track|Highlight|Schedule)/i) &&
          !nameVariants.some(n => isSimilarToArtistName(candidate, n))) {
        result.title = candidate;
      }
    }
  }

  // 패턴 3: 해시태그에서 추출 (#BODYWAVE, #PromiseForYou 등)
  if (!result.title) {
    const hashtags = text.match(/#([A-Za-z0-9가-힣_]+)/g);
    if (hashtags) {
      // 아티스트 이름 해시태그가 아닌, 앨범명으로 보이는 해시태그 찾기
      for (const tag of hashtags) {
        const cleaned = tag.replace('#', '');
        // 일반적인 아티스트 관련 해시태그 제외
        if (cleaned.length > 2 && 
            !cleaned.match(/^(컴백|데뷔|컨셉포토|트랙리스트|하이라이트|스케줄|Concept|Track|Schedule|Photo|Teaser|MV|뮤비)/i) &&
            !nameVariants.some(n => isSimilarToArtistName(cleaned, n))) {
          // 이것이 앨범명일 가능성이 있으면 저장 (나중에 다른 포스트와 교차 확인)
          if (!result.title) result.title = cleaned;
        }
      }
    }
  }

  return result;
}

/**
 * 추출된 타이틀이 아티스트명과 유사한지 체크 (채널명을 앨범명으로 오인하는 것을 방지)
 */
function isSimilarToArtistName(title: string, artistName: string): boolean {
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const normalizedArtist = artistName.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  return normalizedTitle === normalizedArtist || 
         normalizedTitle.includes(normalizedArtist) || 
         normalizedArtist.includes(normalizedTitle);
}

/**
 * 아티스트의 YouTube 커뮤니티 탭에서 최근 7일 이내 포스트를 스캔하여
 * 컴백 정보(앨범명, 발매일, 타입)를 추출한다.
 * 
 * @param artistName - 아티스트명 (검색용)
 * @param officialYoutubeUrl - Artist DB에 저장된 공식 유튜브 URL (있으면 우선 사용)
 * @returns 추출된 정보 또는 null
 */
export async function fetchYouTubeCommunityInfo(
  artistName: string,
  officialYoutubeUrl?: string
): Promise<YouTubeExtractedInfo | null> {
  try {
    const youtube = await Innertube.create();
    const channelId = await resolveChannelId(youtube, artistName, officialYoutubeUrl);
    
    if (!channelId) {
      logger.info(`[YT] Could not resolve channel for ${artistName}`);
      return null;
    }

    const channel = await youtube.getChannel(channelId);
    const channelName = channel.metadata?.title || "";
    const community = await channel.getCommunity();

    if (!community.posts || community.posts.length === 0) {
      logger.info(`[YT] No community posts for ${artistName}`);
      return null;
    }

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // 포스트들을 종합해서 가장 풍부한 정보를 합산
    const aggregated: YouTubeExtractedInfo = {};

    for (const post of community.posts.slice(0, 10)) {
      // 포스트 텍스트 추출 (다양한 속성명 대응)
      let text = "";
      if (post.content) text = post.content.toString();
      else if ((post as any).text) text = (post as any).text.toString();
      else if ((post as any).snippet) text = (post as any).snippet.text?.toString() || "";
      
      if (!text || text.length < 5) continue;

      // 게시 시점 필터: published_at 또는 published 속성 확인
      const publishedText = (post as any).published?.text?.toString() || (post as any).date_text?.toString() || "";
      // "1일 전", "3일 전", "1주 전" 등의 한국어 패턴으로 7일 필터링
      if (publishedText) {
        const daysMatch = publishedText.match(/(\d+)일\s*전/);
        const weeksMatch = publishedText.match(/(\d+)주\s*전/);
        const monthsMatch = publishedText.match(/(\d+)개월\s*전/);
        const hoursMatch = publishedText.match(/(\d+)시간\s*전/);
        
        if (monthsMatch) continue; // 1개월 이상은 스킵
        if (weeksMatch && parseInt(weeksMatch[1]) > 1) continue; // 2주 이상은 스킵
        if (daysMatch && parseInt(daysMatch[1]) > 7) continue; // 7일 초과는 스킵
        // hours, minutes, "방금" 등은 7일 이내이므로 통과
      }

      const extracted = extractInfoFromPost(text, artistName, channelName);

      // 추출된 날짜가 과거이면 무시 (이미 지난 이벤트/발매)
      if (extracted.releaseDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (extracted.releaseDate < todayStr) {
          extracted.releaseDate = undefined;
          // 날짜가 과거이면 해당 포스트의 타이틀/타입도 신뢰도가 낮으므로 스킵
          continue;
        }
      }

      // 합산: 빈 필드만 채움
      if (extracted.title && !aggregated.title) aggregated.title = extracted.title;
      if (extracted.releaseDate && !aggregated.releaseDate) aggregated.releaseDate = extracted.releaseDate;
      if (extracted.releaseType && !aggregated.releaseType) aggregated.releaseType = extracted.releaseType;

      // 이미지(컨셉 포토/자켓) 추출
      if (!aggregated.albumCoverUrl && (post as any).attachment) {
        const attachment = (post as any).attachment;
        let imageUrl = "";
        
        // BackstageImage, PostMultiImage 등 다양한 이미지 첨부 대응
        if (attachment.type === "BackstageImage" && attachment.image?.length > 0) {
          imageUrl = attachment.image[attachment.image.length - 1].url;
        } else if (attachment.type === "PostMultiImage" && attachment.images?.length > 0) {
          const firstImg = attachment.images[0].image;
          if (firstImg?.length > 0) {
            imageUrl = firstImg[firstImg.length - 1].url;
          }
        } else if (attachment.image?.length > 0) {
          imageUrl = attachment.image[attachment.image.length - 1].url;
        }
        
        if (imageUrl) {
          aggregated.albumCoverUrl = imageUrl;
        }
      }
    }

    // 최소 하나라도 유효한 정보가 있으면 반환
    if (aggregated.title || aggregated.releaseDate || aggregated.releaseType || aggregated.albumCoverUrl) {
      logger.info(`[YT] Extracted from ${artistName}: title=${aggregated.title}, date=${aggregated.releaseDate}, type=${aggregated.releaseType}, image=${!!aggregated.albumCoverUrl}`);
      return aggregated;
    }

    logger.info(`[YT] No useful comeback info found in ${artistName}'s community posts`);
    return null;
  } catch (e: any) {
    logger.error(`[YT] Error fetching community for ${artistName}: ${e.message}`);
    return null;
  }
}
