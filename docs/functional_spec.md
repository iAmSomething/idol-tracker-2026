# Functional Specification (기능 구성도 및 단위업무 설명)

## 1. 기능 구성도 (Functional Architecture)

```mermaid
graph LR
    User([일반 사용자]) --> Main[메인 화면]
    
    subgraph Main Screen
        Main --> Cal[월별 캘린더 뷰]
        Main --> Time[컴백 타임라인 뷰]
        Main --> Search[전역 검색 (아티스트/앨범)]
    end
    
    Cal --> ComebackModal[컴백 상세 다이얼로그]
    Time --> ComebackPage[컴백 상세 페이지]
    Time --> ArtistPage[아티스트 상세 페이지]
    Search --> ComebackPage
    Search --> ArtistPage
    
    ComebackModal --> TrackDetail[트랙리스트 및 상세]
    ComebackPage --> TrackDetail
    TrackDetail --> ComposerModal[작곡가별 트랙 모아보기]
```

---

## 2. 단위업무별 기능설명 및 개발문서

### 2.1 메인 대시보드 (`app/page.tsx`)
*   **기능 요약:** 서비스의 첫 진입점으로, 월별 달력과 타임라인을 양분하여 보여주며, 다크모드 토글 및 전역 검색 입력창을 포함.
*   **주요 컴포넌트:**
    *   `CalendarGrid.tsx`: 현재 선택된 월의 데이터를 Firestore에서 필터링하여 일자별로 매핑.
    *   `UpcomingTimeline.tsx`: 오늘 이후의 데이터를 날짜 오름차순으로 최대 10개까지 로드하여 노출.
    *   `ThemeToggle.tsx`: `next-themes`를 활용한 라이트/다크 테마 전환.

### 2.2 캘린더 뷰 (`app/_components/CalendarGrid.tsx`)
*   **기능 요약:** 해당 월(Month)의 날짜 셀에 컴백 앨범 커버, 아티스트명, 앨범명을 타일 형태로 배치. 컴백 형태(Group, Solo, Unit)에 따른 필터링을 지원.
*   **데이터 조달:** 
    *   `where("releaseDate", ">=", startStr)` ~ `<= endStr` 필터로 월 단위 조회 최적화.
*   **상호작용:** 타일 클릭 시 모달(`ComebackDialog`) 렌더링.

### 2.3 컴백 상세 조회 (`app/_components/ComebackDialog.tsx` & `app/comeback/page.tsx`)
*   **기능 요약:** 특정 컴백의 메타데이터(발매일, 기획사 등), YouTube 뮤직비디오 플레이어, 트랙리스트 배열, 음원 사이트 링크 제공.
*   **데이터 조달:**
    *   컴백 문서 조회 (`comebacks` collection)
    *   해당 컴백의 트랙 목록 조회 (`where("comebackId", "==", id)`)
*   **특수 기능:** 트랙 정보 내 작곡가명 클릭 시 해당 작곡가의 다른 곡들을 모아보는 다이얼로그 연동.

### 2.4 트랙/작곡가 조회 (`app/_components/ComposerTracksDialog.tsx` & `ComebackDialog.tsx`)
*   **기능 요약:** 클릭된 작곡가가 참여한 트랙들을 조회하여 팝업으로 노출합니다.
*   **탐색 로직 최적화:** 
    *   트랙 리스트 렌더링 시, 각 트랙의 `composers` 배열 내 작곡가 이름들에 대해 `where("composers", "array-contains", comp)`, `limit(2)` 쿼리를 백그라운드에서 실행합니다.
    *   결과가 2개 이상일 경우(즉, 본인 트랙 외에 다른 트랙을 작곡한 이력이 있는 경우)에만 해당 작곡가 이름에 클릭 가능한 밑줄(`clickable`) UI를 활성화합니다.
*   **데이터 조달:** 작곡가 이름 클릭 시 `where("composers", "array-contains", composerName)` 쿼리를 통해 해당 작곡가의 모든 트랙을 가져옵니다.

### 2.5 아티스트 상세 조회 (`app/artist/page.tsx`)
*   **기능 요약:** 아티스트 프로필 이미지, 그룹/솔로 여부, 세대, 멤버 목록, 소셜 미디어 바로가기 링크(SNS, 나무위키 등) 및 전체 발매 히스토리 목록 제공.
*   **상호작용:** 발매 히스토리 클릭 시 해당 컴백 상세 페이지로 이동.

---

## 3. 관리자/지원 단위업무 (백그라운드 스크립트)

*경로: `/scripts/*`*

*   **크롤링 단위업무 (`auto_crawler.ts` 등):** 외부 데이터를 정기적으로 긁어와 Firestore에 새로운 `artists`, `comebacks`, `tracks` 문서로 저장.
*   **백필링 및 마이그레이션 (`fetch_all_track_credits.ts` 등):** 기존 데이터의 부족한 부분(예: 트랙 내 작사/작곡가 배열 등)을 외부에서 조회해 채워넣음.
    *   *주의사항:* 대량의 데이터 마이그레이션 시 전체 DB 읽기가 반복되지 않도록 JSON 파일 덤프를 활용하거나, 조건을 엄격히(`limit`, `where`) 걸어 쿼리 최적화를 필수적으로 해야 함.
