# Interface Specification (인터페이스 구성도)

## 1. 내부 인터페이스 (데이터베이스 스키마)

시스템 내부 데이터는 Google Cloud Firestore (NoSQL)를 통해 관리되며, 프론트엔드는 Firebase Client SDK를 사용하여 읽기 전용(`ReadOnly`) 통신을 합니다.

### 1.1 데이터 타입 및 형식 (`types/index.ts` 기준)

#### Collection: `artists`
*   **역할:** K-Pop 아티스트(그룹, 솔로, 유닛) 메타데이터
*   **주요 속성:**
    *   `id` (string): 문서 식별자
    *   `name` (Object): `{ ko: string, en: string, aliases: string[] }`
    *   `generation` (number): K-Pop 세대
    *   `type` (string): `"group" | "solo" | "unit"`
    *   `members` (Array): 멤버 정보 배열 `[{ name, artistId }]`
    *   `socialLinks` (Object): YouTube, Instagram, X, TikTok, Weverse, 나무위키 주소

#### Collection: `comebacks`
*   **역할:** 아티스트의 앨범 발매(컴백) 이벤트 메타데이터
*   **주요 속성:**
    *   `id` (string): 문서 식별자
    *   `artistId` (string): 연관 아티스트 ID (FK)
    *   `albumTitle` (string): 앨범명
    *   `releaseDate` (string): 발매일 (`YYYY-MM-DD` 형식)
    *   `releaseType` (string): `"single" | "ep" | "full"` 등
    *   `mediaLinks` (Object): 뮤직비디오(`musicVideo`) 및 티저 URL 배열

#### Collection: `tracks`
*   **역할:** 개별 앨범에 속한 수록곡 메타데이터
*   **주요 속성:**
    *   `id` (string): 문서 식별자
    *   `comebackId` (string): 연관 컴백 ID (FK)
    *   `name` (string): 트랙 제목
    *   `isTitle` (boolean): 타이틀곡 여부
    *   `composers` (string[]): 작곡가 목록 배열
    *   `lyricists` (string[]): 작사가 목록 배열

---

## 2. 외부 연동 인터페이스

크롤러 및 스크립트를 통한 외부 데이터 연동 프로토콜 사양입니다.

### 2.1 Bugs Music 웹 파싱
*   **연동 목적:** 컴백 기본 정보, 트랙리스트, 작사/작곡 크레딧 수집
*   **프로토콜:** HTTPS GET 요청
*   **형식:** HTML (Cheerio를 사용하여 DOM 파싱)
*   **주요 엔드포인트:**
    *   `https://music.bugs.co.kr/album/:albumId`
    *   `https://music.bugs.co.kr/track/:trackId`

### 2.2 YouTube API 및 스크래핑
*   **연동 목적:** 뮤직비디오 자동 매칭, 공식 채널 탐색, 커뮤니티 게시글 추출
*   **프로토콜:** HTTPS (REST 및 내부 Proto)
*   **사용 라이브러리:** `youtubei.js` 및 `yt-search`
*   **데이터 형식:** JSON

### 2.3 기타 메타데이터 검색 (Google, DuckDuckGo)
*   **연동 목적:** 나무위키 링크, SNS 소셜 링크 유추 및 보완
*   **사용 라이브러리:** `google-it`, `duck-duck-scrape`
*   **형식:** 검색 결과 JSON 객체

---

## 3. 인터페이스 보안 및 권한 프로토콜
*   **Firestore Rules:** `firestore.rules` 파일에 정의되어 있음. 프론트엔드에서는 모든 콜렉션에 대해 읽기(`read`) 권한만 허용됨. 쓰기(`write`), 수정(`update`), 삭제(`delete`)는 Firebase Admin SDK를 사용하는 서버 측 로직(Scripts)에서만 접근 가능하도록 차단.
