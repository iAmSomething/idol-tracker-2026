# System Architecture (시스템 아키텍처 및 소프트웨어 구성도)

## 1. 현행 시스템 구성 (Current System Configuration)

Idol Tracker 2026은 K-Pop 아이돌의 컴백 일정, 앨범 발매, 뮤직비디오, 트랙 정보 등을 시각적으로 제공하는 캘린더형 웹 플랫폼입니다.

### 1.1 주요 서비스 (프론트엔드)
*   **월별 캘린더 (Calendar Grid):** 특정 월의 모든 컴백 일정을 일자별로 그리드 형태로 시각화.
*   **컴백 타임라인 (Upcoming Timeline):** 오늘 날짜 기준으로 다가오는 가장 빠른 컴백 정보 최대 10건을 타임라인 형태로 표시.
*   **아티스트 상세 (Artist Profile):** 특정 아티스트의 프로필, 소셜 미디어 링크, 최신 뮤직비디오, 전체 컴백 히스토리 제공.
*   **컴백 상세 (Comeback Detail):** 단일 컴백(앨범)의 뮤직비디오, 전체 트랙리스트, 각 트랙의 작사/작곡 정보, 음원 스트리밍 링크 제공.

### 1.2 지원 업무 (운영 및 백그라운드 스크립트)
*   **데이터 크롤러 (Crawlers):** 외부 시스템(Bugs, YouTube, Spotify 등)을 스크래핑하여 새로운 아티스트와 앨범 데이터를 DB에 적재 (`auto_crawler.ts`, `fetch_spotify_releases.ts`).
*   **데이터 백필링 (Backfilling):** 누락된 과거 뮤직비디오 링크, 작사/작곡 크레딧 등 부족한 데이터를 채워 넣는 작업 (`fetch_official_mvs.ts`, `fetch_track_credits.ts`, `fetch_all_track_credits.ts`).
*   **데이터 클렌징 및 정제 (Cleansing):** 
    *   동일 아티스트 병합 및 ID 마이그레이션 (`migrate_artist_ids.ts`).
    *   중복 삽입된 컴백 및 트랙 문서 제거 (`deduplicate_comebacks.ts`, `deduplicate_tracks.ts`).
    *   누락된 아티스트 분류 타입(Group/Solo) 수정 (`infer_artist_types.ts`, `fix_comeback_artist_types.ts`).

---

## 2. 시스템 아키텍쳐 구성도 (System Architecture Diagram)

```mermaid
graph TD
    %% 프론트엔드 영역
    subgraph Frontend [Client / Next.js Frontend]
        UI[React User Interface]
        Pages[Next.js App Router]
        Hooks[Firebase Data Fetch Hooks]
    end

    %% 클라우드 서비스 영역
    subgraph Cloud [Firebase Cloud Services]
        Firestore[(Cloud Firestore NoSQL)]
        Auth[Firebase Authentication]
    end

    %% 관리자/운영 영역
    subgraph Admin [Admin / Crawler Scripts]
        AutoCrawler[auto_crawler.ts]
        DataCleaners[Data Migration & Cleaners]
    end

    %% 외부 데이터 소스 영역
    subgraph External [External APIs & Web]
        Bugs[Bugs Music Web]
        YouTube[YouTube Data & Community]
        Spotify[Spotify API]
    end

    %% 데이터 흐름
    UI -->|Render & Interact| Pages
    Pages -->|Query Docs| Hooks
    Hooks -->|Read Only| Firestore
    
    AutoCrawler -->|Scrape| Bugs
    AutoCrawler -->|API Request| YouTube
    AutoCrawler -->|API Request| Spotify
    
    AutoCrawler -->|Write/Update| Firestore
    DataCleaners -->|Batch Read/Write/Delete| Firestore
```

---

## 3. 소프트웨어 구성도 (Software Architecture)

### 3.1 기술 스택
*   **Framework:** Next.js 16 (App Router 기반)
*   **Library:** React 19, TypeScript
*   **Database:** Firebase Firestore (NoSQL Document Store)
*   **Styling:** Vanilla CSS (globals.css), Lucide React & React Icons (아이콘 패키지)
*   **Data Fetching & Automation (Scripts):**
    *   `cheerio`: 웹 스크래핑 및 HTML 파싱
    *   `youtubei.js` / `yt-search`: YouTube 비공식 API 및 검색 크롤링
    *   `spotify-web-api-node`: Spotify 공식 API 연동
    *   `duck-duck-scrape` / `google-it`: 외부 메타데이터 검색

### 3.2 디렉토리 구조 (Directory Structure)

```text
/idol_tracker
 ├── app/                      # Next.js App Router 페이지 및 전역 CSS
 │   ├── _components/          # 전역 및 재사용 가능한 React 컴포넌트
 │   ├── artist/               # 아티스트 상세 페이지 라우트 (/artist?id=...)
 │   ├── comeback/             # 컴백 상세 페이지 라우트 (/comeback?id=...)
 │   ├── track/                # 곡 상세 페이지 라우트 (/track?id=...)
 │   └── firebase.ts           # Firebase 클라이언트 SDK 초기화 설정
 ├── types/                    # 시스템 전역 TypeScript 타입 및 인터페이스 정의 (index.ts)
 ├── scripts/                  # 크롤링, 데이터 백필링, DB 마이그레이션 백엔드 스크립트 모음
 │   └── lib/                  # 스크립트 공통 유틸리티 모음 (로거, 딜레이 함수 등)
 ├── docs/                     # 시스템 문서화 폴더
 ├── package.json              # 패키지 의존성 및 스크립트 명령어 관리
 └── firebase.json             # Firebase 호스팅 및 기타 Firebase 서비스 설정
```
