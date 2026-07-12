<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# IDOL TRACKER 2026 - 종합 정책 및 프로젝트 아키텍처 문서
본 문서는 프로젝트의 구조, 정책, 데이터베이스 스키마, 크롤링 자동화 전략 등을 총망라한 가이드라인입니다. **모든 Agent는 작업 전 이 문서를 최우선으로 숙지하고 따라야 합니다.**

---

## 1. 프로젝트 개요 및 기술 스택
- **프론트엔드:** Next.js 16.2 (App Router), React 19, TypeScript
- **스타일링:** Vanilla CSS (`globals.css`), CSS Modules. (Tailwind CSS는 사용하지 않으며, Bento-Grid 및 Warm-Tech 디자인 시스템을 준수함)
- **백엔드/DB:** Firebase Firestore, Firebase Hosting
- **자동화/스크립팅:** GitHub Actions (Cron), Node.js (`tsx`), `rss-parser`, `cheerio` 등

## 2. 데이터베이스 스키마 (Firestore)
Firestore 데이터베이스는 크게 두 개의 핵심 컬렉션으로 구성됩니다.

### 1) `artists` (아티스트 마스터 데이터)
- `name`: 객체 형태 (`{ ko: "이름", en: "Name" }`) 또는 문자열
- `type`: 아티스트 형태 (`group` | `solo` | `unit`)
- `gender`: 성별 (`male` | `female` | `mixed`)
- `parentGroupId`: 솔로나 유닛인 경우 본 그룹과의 릴레이션을 위한 참조 ID
- `aliases`: 검색을 위한 다양한 별명 배열

### 2) `comebacks` (컴백 일정 데이터)
- `artistName`, `artistId`: 컴백 주체 아티스트 매핑
- `releaseDate`: 발매일 (YYYY-MM-DD 형식)
- `releaseType`: 발매 형태 (`full` | `mini` | `single`)
- `title`, `albumCoverUrl`, `agencyName`: 앨범/곡 정보
- `isReleased`: 발매일이 지나 데이터 픽스 및 데일리 크롤링에서 제외되었는지를 나타내는 Boolean 플래그
- `recentNews`: 발매 전 수집된 티저/트랙리스트 기사 배열

## 3. 핵심 자동화 파이프라인 정책 (AI 사용 금지)
> ⚠️ **핵심 정책 (중요):** 잦은 에러와 Quota 비용 문제를 방지하기 위해 데일리 컴백 크롤러 및 백엔드 자동화 스크립트에서는 **Gemini 등 외부 LLM API 사용을 엄격히 금지**합니다. 텍스트 파싱은 자체 정규식 로직 및 Bugs API, YouTube 교차 검증으로 해결합니다.

크롤링은 GitHub Actions를 통해 **주간(Weekly)**과 **일간(Daily)**으로 완전히 분리되어 운영됩니다.

### 1) 주 1회 전체 크롤링 (Weekly Discovery) - `scripts/weekly_discovery_crawler.ts`
- **목적:** 기존 ArtistDB에 없는 신규 아티스트의 컴백/데뷔 발굴.
- **주기:** 매주 화요일 18:30 (KST)
- **동작 방식:**
  1. 구글 뉴스 RSS에 `"컴백" OR "데뷔" OR "신곡"` 검색. (최근 **7일 이내** 기사만 수집)
  2. 추출된 이름이 신규일 경우, **벅스(Bugs) 뮤직 API**에 검색을 수행.
  3. 벅스 검색 결과에 `배우/개그맨/방송인`이 포함되어 있거나 아티스트 결과가 없으면 **스킵(Skip)**.
  4. 실제 `그룹/가수`임이 확인되면 성별 메타데이터와 함께 `artists` 컬렉션에 신규 등록 대기.
  5. 기존 아티스트든 신규 아티스트든 발매일/앨범명이 불확실(TBA)할 경우, **YouTube Community 교차 검증**을 수행.
  6. Admin Dashboard 대기열(`pending_reviews`)로 전송.

### 2) 매일 정밀 크롤링 (Daily Precision) - `scripts/daily_precision_crawler.ts`
- **목적:** 발매일이 가까워진 아티스트의 세부 정보 확보, TBA 데이터 보강 및 발매 완료 처리.
- **주기:** 매일 18:30 (KST)
- **동작 방식:**
  1. `comebacks` DB에서 `releaseDate`가 오늘 기준 **0일 ~ 7일 후**인 컴백 대상만 추출하여 티저/트랙리스트 정밀 검색 (맹목적인 전체 크롤링 금지).
  2. 날짜가 불명확하거나 앨범명이 `TBA`인 항목은 **YouTube Community 교차 검증**을 통해 데이터 자동 보강.
  3. **발매 완료 처리:** 발매일(`releaseDate`)이 현재 시스템 시간 기준으로 지난 경우, 크롤링 대상에서 영구 제외(`isReleased: true` 업데이트)하고 Bugs/YouTube를 통해 최종 메타데이터를 수집.

### 3) YouTube Community 교차 검증 파이프라인 (`scripts/lib/youtube_scraper.ts`)
기사 본문을 크롤링하지 못하는 한계를 극복하고 가장 확실한 오피셜 정보를 얻기 위한 파이프라인입니다.
- **채널 탐색:** Artist DB에 저장된 공식 유튜브 URL(`socialLinks.youtube`)을 최우선으로 사용하며, 없을 경우 `yt-search`로 검색된 첫 번째 채널을 폴백으로 사용.
- **기간 제한:** 커뮤니티 탭 포스트 중 최근 **7일 이내**의 포스트만 스캔 (한국어 시간 "X일 전", "X주 전" 정규식 파싱).
- **오탐 방지 (False Positive 방어):** 
  - 콘서트/팬미팅/투어/기념일 관련 포스트는 즉시 스킵 (블랙리스트 정규식).
  - 정규식으로 추출된 날짜가 현재 시간 기준 '과거'인 경우 폐기.
  - 추출된 앨범명 후보가 아티스트명이나 채널 영문명과 동일할 경우 폐기 (해시태그 오인 방지).
- **LLM 프리:** 외부 AI 개입 없이 순수 정규식 패턴(날짜 포맷, 미니/정규/싱글 키워드, 특수문자 따옴표 매칭 등)만으로 앨범명과 발매일 추출.

## 4. 프론트엔드 UI/UX 정책
1. **디자인 톤앤매너:** 다크 모드 시 `Warm-tech` 테마 (`#0b0a09` 배경, `#ff6b00` 포인트) 준수.
2. **성별 및 분류 필터링 규칙:**
   - 캘린더 UI의 필터는 "보이그룹(남) / 걸그룹(여) / 혼성" 과 "Group / Solo / Unit" 으로 직관적으로 구성합니다.
   - 솔로 아티스트(예: 연준)는 원본 그룹(예: 투모로우바이투게더)과 상호 릴레이션이 있어야 하며, 필요 시 원본 그룹 필터에도 걸리도록 처리합니다.
3. **음원 및 뮤직비디오 연동 (YouTube Music):**
   - 개별 MV URL만 의존하기보다는 `music.youtube.com`에서 아티스트나 앨범명으로 바로 검색/재생되도록 연동하는 방식을 우선시합니다.
4. **Bento-Grid 레이아웃:** `CalendarGrid`와 `UpcomingTimeline`을 좌우 또는 상하로 배치하고, 컨테이너 쿼리와 Grid 시스템을 활용해 촘촘하고 비대칭적인 UI를 만듭니다.

## 5. Git Commit Guidelines
- 커밋 메시지는 한국어(한글)로 작성하며, **어떤 변경을 왜 했는지 상세하게** 남겨주세요.
