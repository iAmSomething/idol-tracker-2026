import re

with open("/Users/gimtaehun/idol_tracker/AGENTS.md", "r", encoding="utf-8", errors="surrogateescape") as f:
    content = f.read()

new_section5 = """## 5. Git Commit Guidelines 및 형상 관리(Version Control) 원칙
본 프로젝트의 모든 변경 사항은 추후 트러블슈팅과 히스토리 추적을 위해 완벽한 형태의 Git Commit History로 남아있어야 합니다. 단순한 "Update"나 "Fix bug" 같은 성의 없고 기계적인 AI식 커밋 메시지 작성은 절대로 허용되지 않으며, 변경의 **이유(Why)**와 **맥락(Context)**이 가장 상세하게 기록되어야 합니다. 아래의 엄격한 가이드라인을 단 하나라도 어겨서는 안 됩니다.

### 5-1. 커밋 메시지 언어 및 기본 형식 강제
- **작성 언어:** 모든 커밋 메시지의 제목(Subject)과 본문(Body)은 반드시 **한국어(한글)**로 작성해야 합니다. 영어를 섞어 쓰는 것은 기술 용어(예: `useEffect`, `Firestore`, `Ollama` 등)에 한정합니다.
- **포맷 강제 (Conventional Commits 변형):** 커밋 메시지는 반드시 `타입(Scope): 제목` 형태로 시작해야 하며, 본문과 한 줄의 빈 줄로 구분되어야 합니다.
  ```text
  타입(스코프): 커밋 제목 (50자 이내, 핵심만 요약)

  본문 (상세한 변경 이유와 컨텍스트, 72자마다 줄바꿈)
  - 무엇을 변경했는가? (What)
  - 왜 변경했는가? (Why)
  - 어떤 부작용(Side Effect)이 예상되는가?

  꼬리말 (이슈 번호, Breaking Change 등)
  ```

### 5-2. 커밋 타입 (Commit Type) 분류 규칙
어떤 작업을 했는지 명확히 알 수 있도록, 반드시 아래에 지정된 8가지 타입 중 하나로 시작해야 합니다.
- **`feat` (기능):** 새로운 기능이나 화면, API 라우트를 추가할 때 사용합니다. (예: `feat(crawler): 유튜브 커뮤니티 정규식 스크래핑 기능 추가`)
- **`fix` (버그 수정):** 기존 기능의 치명적인 오류나 버그, 환각(Hallucination) 현상을 해결했을 때 사용합니다. (예: `fix(parser): Qwen 환각으로 인해 인원수(20명)를 날짜로 착각하는 오탐 버그 해결`)
- **`docs` (문서화):** 리드미(`README.md`)나 현재 이 문서(`AGENTS.md`) 같은 정책/가이드 문서를 수정했을 때 사용합니다.
- **`style` (스타일링/UI):** 비즈니스 로직의 변경 없이 UI 컴포넌트의 CSS, 마진, 벤토 그리드 레이아웃, 컬러 테마 등을 변경했을 때 사용합니다. (예: `style(calendar): 벤토 타일 간격 12px 강제 및 모서리 곡률 조정`)
- **`refactor` (리팩터링):** 기능의 결과는 동일하지만 코드를 더 읽기 쉽고 성능이 좋게 재구성했을 때 사용합니다. (예: `refactor(db): Alias 크로스체크 루프를 Set 자료구조로 변경하여 O(1) 조회로 최적화`)
- **`perf` (성능):** LCP, INP, 메모리 누수 방지 등 렌더링 성능이나 실행 속도를 크게 개선한 경우 사용합니다.
- **`test` (테스트):** 테스트 코드(Jest, Cypress 등)를 추가하거나 수정했을 때 사용합니다.
- **`chore` (잡일):** 패키지 설치(`package.json` 변경), 빌드 스크립트 수정, 기타 설정 파일(`next.config.js`) 변경 등 애플리케이션 실제 동작과 무관한 변경 시 사용합니다.

### 5-3. 커밋 본문 (Body) 작성 철칙: "HOW"가 아닌 "WHY"에 집중할 것
- "코드를 어떻게(How) 고쳤는가"는 이미 Git Diff를 보면 알 수 있습니다. 절대 커밋 본문에 코드를 어떻게 짰는지 기계적으로 나열하지 마십시오.
- **반드시 명시해야 할 것:** 이 변경이 왜 필요했는지(Why), 기존 코드의 어떤 부분이 사용자에게 피해를 주었는지(Context), 그리고 이 패치로 인해 다른 컴포넌트에 어떤 영향을 미치는지(Side Effect)를 소설 쓰듯 가장 구체적으로 명시해야 합니다.
  - ❌ [나쁜 예]: `fix(crawler): 7일 조건문 추가. Qwen 프롬프트 수정함.`
  - ✅ [좋은 예]: 
    ```text
    fix(crawler): 과거 컴백 데이터 영구 누락 버그 해결 및 환각 방지책 추가

    [문제 원인]
    과거 스크립트에서 `releaseDate < todayStr` 비교 로직을 하드코딩하여, 크롤러 실행 시점 기준 하루라도 지난 앨범 발매 데이터(아이덴티티, 영파씨 등)가 통째로 스킵되는 끔찍한 데이터 유실 사태가 발생함.
    또한 LLM이 기사 본문의 '20명'이라는 인원수를 '20일'로 착각하는 치명적 환각 버그가 있었음.

    [해결책]
    1. todayStr 대신 과거 7일을 포함하는 롤링 윈도우(sevenDaysAgoStr) 로직으로 교체하여 어제/오늘 발매건이 정상 수집되도록 보장함.
    2. Qwen 프롬프트에 '숫자(N명, N주년)를 날짜로 착각하지 말 것'이라는 강력한 예외 처리 문구를 하드코딩함.
    ```

### 5-4. 브랜치(Branch) 네이밍 및 병합(Merge) 전략
- Main 브랜치(`main` 또는 `master`)에는 절대 직접 커밋(Direct Commit)하지 마십시오.
- 모든 작업은 반드시 `타입/이슈단어-요약` 형태의 브랜치에서 진행되어야 합니다.
  - 예: `feature/youtube-scraper`, `hotfix/alias-merge-error`, `refactor/bento-grid-ui`
- 작업이 완료되면 코드 리뷰(혹은 자체 검증)를 거친 후 Main 브랜치로 병합하며, 섣부른 병합으로 인해 기존 기능이 깨지는 일(Regression)이 없도록 테스트 스크립트를 먼저 구동해야 합니다.

### 5-5. 파괴적 변경 (Breaking Changes) 명시 의무
- 만약 DB 스키마 필드명을 바꾸거나, 크롤러의 핵심 파싱 로직을 통째로 엎어서 기존 데이터들과 심각한 호환성 문제가 생기는 작업일 경우, 커밋 메시지 맨 하단(꼬리말)에 반드시 `BREAKING CHANGE:` 키워드를 대문자로 명시하고 어떤 조치가 추가로 필요한지 경고해야 합니다.
  - 예: `BREAKING CHANGE: artists 컬렉션의 name 필드가 string에서 {ko, en} 객체로 변경됨. 프론트엔드 전체의 렌더링 에러를 막기 위해 마이그레이션 스크립트를 먼저 실행해야 함.`
"""

pattern = r"## 5\. Git Commit Guidelines.*"

new_content = re.sub(pattern, new_section5, content, flags=re.DOTALL)

with open("/Users/gimtaehun/idol_tracker/AGENTS.md", "w", encoding="utf-8", errors="surrogateescape") as f:
    f.write(new_content)

print("Section 5 updated successfully via python.")
