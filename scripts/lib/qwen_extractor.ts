import axios from "axios";

export interface QwenExtractedInfo {
  artistName: string | null;
  title: string | null;
  date: string | null;
  type: string | null;
  artistType: string | null;
  isMusicComeback: boolean | null;
  summary: string | null;
}

/**
 * Parses article text using a local Ollama instance running Qwen3.
 * Falls back to null values if Ollama is unreachable.
 */
export async function parseArticleWithQwen(articleText: string, title: string, pubDate: string, targetArtist?: string): Promise<QwenExtractedInfo | null> {
  const targetInstruction = targetArtist ? `이 요약은 오직 '${targetArtist}'의 컴백/데뷔 정보에 초점을 맞춰야 합니다. 만약 기사에 '${targetArtist}'의 구체적인 컴백 정보가 없다면 summary를 null로 반환하세요.` : '';

  const prompt = `다음은 K-Pop 아이돌 컴백/데뷔에 관한 뉴스 기사입니다. 기사를 읽고 다음 정보만 추출해서 JSON 형태로 반환하세요:
- artistName: 이번 컴백/데뷔의 주체인 아티스트 이름 (예: 기사가 그룹 멤버의 솔로 컴백을 다루면 그룹명이나 수식어구를 제외한 해당 멤버의 고유명사 이름만 추출. 예: 'DAY6 영케이 솔로 컴백' 이면 '영케이'만 추출, '20인조 아이덴티티' 이면 '아이덴티티'만 추출)
- title: 발매되는 앨범명 또는 곡명 (예: 'I Got Your Back'). 기사에 명시되어 있지 않으면 null.
- date: YYYY-MM-DD 형식의 발매일. **[매우 중요]** 기사에 '선공개'와 '정식 발매' 날짜가 두 개 존재할 경우, 무조건 더 빠른 **'선공개'** 날짜를 선택하세요. (예: X일 선공개, Y일 정식발매 -> X일 선택).
- type: 'full'(정규), 'mini'(미니/EP), 'single'(싱글) 중 하나 (없으면 null)
- artistType: 'group'(그룹), 'solo'(솔로), 'unit'(유닛) 중 하나 (없으면 null)
- isMusicComeback: 이 기사가 "새로운 신곡이나 새 앨범을 발표하는 컴백/데뷔" 기사인지 여부 (true/false). 음방 1위 수상, 음원차트/아이튠즈 순위 기록, 뮤비 조회수 돌파, 단순 커버 무대, 예능 출연, 팬미팅, 출국, 콘서트 개최, 연기 활동, 결혼 소식, 단순 인터뷰, 과거 회상 기사 등은 절대로 컴백이 아니므로 무조건 false로 설정하세요.
- summary: 기사 내용을 바탕으로 이번 컴백/데뷔의 콘셉트나 특징, 주요 기대 포인트를 2~3문장 이내로 짧게 요약한 텍스트 (알 수 없으면 null). ${targetInstruction}

주의사항: 
- 만약 기사가 드라마/영화/게임/웹툰 등의 OST(사운드트랙) 발매에 관한 것이라면, 모든 필드를 null로 반환하세요. OST는 컴백으로 취급하지 않습니다.
- 기사 작성일은 ${pubDate} 입니다. 기사에 '이날', '오늘'이라는 단어가 발매 시점을 가리키는 경우 반드시 기사 작성일과 동일한 날짜로 설정하세요. 기사에 '지난달'이라는 표현이 있다면 기사 작성일의 월에서 1을 빼서 계산하세요. (예: 기사작성일이 7월이고 '지난달 X일'이면 6월 X일로 계산). 기사에 월 표시 없이 'A일', '내달 B일', '오는 C일' 등으로만 표기된 경우, 반드시 이 기사 작성일을 기준으로 정확한 YYYY-MM-DD를 계산하세요.
- **[매우 중요]** 기사 제목이나 본문에 있는 'N명', 'N집', 'N주년' 등 발매일과 무관한 숫자를 날짜(N일)로 절대 착각하지 마세요! 명확한 발매일을 알 수 없다면 null을 반환하세요.

절대 다른 설명 없이 순수한 JSON 문자열만 응답하세요.

기사 작성일: ${pubDate}
기사 제목: ${title}
기사 본문:
${articleText.substring(0, 3000)}
`;

  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "qwen3:latest",
      prompt: prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.0
      }
    }, {
      timeout: 30000 // 30 seconds max for local inference
    });

    const jsonStr = response.data.response;
    const parsed = JSON.parse(jsonStr);
    return {
      artistName: parsed.artistName || null,
      title: parsed.title || null,
      date: parsed.date || null,
      type: parsed.type || null,
      artistType: parsed.artistType || null,
      isMusicComeback: parsed.isMusicComeback ?? null,
      summary: parsed.summary || null
    };
  } catch (error: any) {
    console.error("❌ [Qwen] API Error:", error.message);
    return null; // Return null on failure to allow graceful fallback
  }
}
