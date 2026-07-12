<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git Commit Guidelines
- 커밋 메시지는 한국어(한글)로 작성하며, 어떤 변경을 왜 했는지 상세하게 남겨주세요.

# Project Policy Decisions (프로젝트 정책 결정사항)
다음은 프로젝트 진행 과정에서 결정된 주요 정책들입니다. 작업 시 반드시 준수하세요.

1. **AI(Gemini) 사용 금지**:
   - 데일리 컴백 크롤러(`scripts/auto_crawler.ts` 등) 등 백엔드/자동화 작업에서 Gemini 등 외부 LLM API를 사용하지 마세요. (요금/Quota 문제 및 잦은 에러 발생).
   - 뉴스나 텍스트 파싱은 단순 키워드 필터링(예: '컴백', '발매' 등) 등 자체 로직으로 처리합니다.

2. **크롤링 전략 (주간/일간 분리 운영)**:
   - **주 1회 전체 크롤링 (Weekly)**: 신규 컴백 팀 정보 크롤링. 뉴스에 등장한 아티스트가 ArtistDB에 없으면 벅스(Bugs) 등 음원 사이트에 검색하여 '배우, 기타 연예인, 단어' 등은 스킵하고 실제 가수/아이돌인 경우에만 신규 Artist로 등록 및 컴백 크롤링 수행.
   - **매일 정밀 크롤링 (Daily)**: 컴백 일정이 "오늘부터 1주일 이내"로 임박한 아티스트들만 집중 타겟. 수록곡/콘셉트 포토 등 신규 정보 발견 시 DB 업데이트. 컴백 날짜가 현재 시간 기준으로 지나면 크롤링 대상에서 제외하고 Bugs/YouTube 등에서 최종 발매 정보 수집.
3. **성별 및 분류 필터링 규칙**:
   - UI 필터는 너무 복잡하게 나누지 않고, "보이그룹(남) / 걸그룹(여) / 혼성" 정도로 직관적으로 구성합니다.
   - 솔로 아티스트(예: 연준)의 경우, 소속된 원본 그룹(예: 투모로우바이투게더)과 상호 릴레이션이 있어야 하며, 원본 그룹의 성별 필터링에도 동일하게 걸릴 수 있도록 처리합니다.

4. **음원 및 뮤직비디오 연동 (YouTube Music)**:
   - 외부 음악 재생/검색 연동 시, 개별 MV URL에 의존하기보다는 `music.youtube.com`에서 아티스트나 앨범명으로 바로 검색/재생되도록 연동하는 방식을 우선시합니다. (MV가 없어도 앨범/음원이 존재하는 경우가 많기 때문)
