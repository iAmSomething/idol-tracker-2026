import re

with open("/Users/gimtaehun/idol_tracker/AGENTS.md", "r", encoding="utf-8", errors="surrogateescape") as f:
    content = f.read()

new_section4 = """## 4. 프론트엔드 UI/UX 정책 및 글로벌 디자인 가이드라인
프론트엔드 코드 작성 및 UI 수정 시, 일반적인 "AI가 짠 듯한 흔한 사내망/어드민 디자인(AI Slop)"을 철저히 배제하고, 최고의 퀄리티와 현대적인 감각을 지닌 Premium Web Design을 구현해야 합니다. 아래 명시된 모든 세부 규칙을 100% 준수해야 하며, 편의를 위해 임의로 규칙을 생략하거나 외부 무거운 라이브러리를 끌어와서는 절대 안 됩니다.

### 4-1. 디자인 바이브 & 시각 언어 (Design Vibe & Language)
- **테마 강제 (Dark Warm-tech):** 차갑고 쨍한 블랙/화이트/블루 계열은 완전히 배제합니다.
  - Background (배경): `#0b0a09` (따뜻한 카본 오프블랙 - 완전 블랙 절대 금지)
  - Primary Text (주 텍스트): `#f5f4f2` (눈이 편안한 따뜻한 페이퍼 화이트)
  - Secondary Text (보조 텍스트): `#8a8885` (뮤트된 따뜻한 그레이)
  - Borders (구분선): `#1f1e1c` (아주 미세하고 얇은 따뜻한 디바이더)
  - Hover Backgrounds (호버 상태): `#1a1917` (부드러운 그레이-브라운)
  - Accent Color (포인트 컬러): `#ff6b00` (채도 높고 따뜻한 탠저린 오렌지 - 브랜드 컬러)
- **형태적 일관성 (Shape Consistency):** 모든 둥근 모서리(Cards, Thumbnails, Floating Bars, Buttons)는 예외 없이 `12px` (`var(--radius-soft)`)을 사용합니다. 날카로운 직각 모서리와 둥근 모서리를 화면 내에서 임의로 섞어 쓰는 것을 엄격히 금지합니다.

### 4-2. 타이포그래피 및 폰트 (Typography & Fonts)
- **폰트 페이스:** 시스템 기본 폰트(Arial, 맑은 고딕 등)나 흔한 Inter의 기본 세팅 사용을 지양합니다. Next.js의 `next/font/google`이나 `@font-face`를 활용하여 고품질 산세리프 디스플레이 폰트(`Outfit`, `Geist`, `Satoshi`, `Cabinet Grotesk` 등)를 로드해 사용합니다.
- **디스플레이 타이포그래피:** 큰 헤딩(Heading) 텍스트는 글자 간격을 좁히고(`letter-spacing: -0.04em` 등) 줄간격을 극한으로 타이트하게(`line-height: 1` 또는 `1.1`) 설정하여 현대적인 잡지(Editorial) 스타일을 구현합니다.
- **디센더 클리어런스(Clearance):** 이탤릭체 디스플레이 헤딩 사용 시, 하단으로 파고드는 글자들(`y, g, j, p, q`)이 타이트한 줄간격 때문에 잘려나가는(Clipping) 현상을 막기 위해 하단 패딩(`padding-bottom`)을 반드시 확보해야 합니다.

### 4-3. 벤토 그리드(Bento-Grid) 및 레이아웃 시스템
- **여백(Spacing) 강제:** 그리드 아이템 사이의 간격은 지저분한 보더라인보다는 깔끔한 `12px` 또는 `16px`의 여백(`gap`)만으로 공간을 분리합니다.
- **비대칭적 역동성 (Asymmetry):** 모든 캘린더나 리스트 아이템이 똑같은 크기의 바둑판식 배열이 되는 것을 극도로 혐오합니다. 2x2(큰 이미지/캔버스), 2x1, 1x1(메타데이터 중심의 작은 타일) 등 다양한 스팬(Span)을 결합하여 시각적 지루함을 타파해야 합니다.
- **그리드 패킹:** 사이즈가 제각각인 벤토 타일들이 빈 공간(구멍) 없이 화면에 꽉 맞물려 들어가도록 CSS Grid의 `grid-auto-flow: dense` 속성을 반드시 적용해야 합니다.
- **반응형 컨테이너 쿼리 (`@container`):** 타일 내부는 뷰포트 기반의 `@media` 쿼리가 아닌 조상 요소 기준의 `@container` 쿼리를 사용하여, 타일이 2x2 공간에 배치되든 모바일 1x1 공간에 배치되든 스스로 내부 레이아웃 조절을 수행할 수 있도록 컴포넌트를 독립적으로 설계해야 합니다.

### 4-4. 인터랙션 및 모션 폴리시 (Interaction & Motion Polish)
- **햅틱/물리적 피드백:** 클릭 가능한 모든 버튼, 네비게이션, 카드 타일은 누르는 순간(`:active`) 물리적으로 눌리는 듯한 피드백(`transform: scale(0.97)` 또는 `transform: translateY(1px)`)을 반드시 주어야 합니다.
- **스무스 이징(Smooth Easing):** 모든 CSS 트랜지션 애니메이션은 촌스러운 `linear`나 기본 `ease`가 아닌, 모던 앱과 동일한 부드러운 이징 커브(예: `cubic-bezier(0.16, 1, 0.3, 1)`)를 적용합니다.
- **스크롤 스냅(Scroll Snap):** 좌우 스와이프나 상하 섹션 이동 인터페이스에서는 네이티브 CSS 속성인 `scroll-snap-type: x mandatory` 등을 사용하여 60fps의 끊김 없는 부드러운 스크롤 경험을 제공합니다.

### 4-5. 2026 최신 웹 표준 준수 및 가벼운 아키텍처
무거운 JS 라이브러리를 덕지덕지 발라 브라우저를 느리게 만드는 행위를 절대 금지합니다.
- **네이티브 Dialog & Popover:** 모달(Modal) 창을 띄울 때 무거운 외부 패키지(Focus-trap, Overlay 등)를 설치하지 마십시오. 반드시 최신 HTML 표준인 `<dialog>` 태그와 네이티브 `popover` 속성을 사용하여 모달, 팝업, 드롭다운을 구현합니다.
- **상태 종속성 제거 (`:has()`):** 폴더에 마우스를 올리거나 자식 요소를 클릭했을 때 부모 요소를 하이라이트하기 위해 불필요한 React 상태(State)와 리렌더링을 유발하지 마십시오. 최신 CSS 선택자인 `:has()`를 사용하여 순수 CSS만으로 상태 변화 디자인을 구현합니다.
- **네이티브 애니메이션:** 뷰 전환이나 스크롤 효과에 GSAP 같은 거대한 런타임 라이브러리 사용을 금지합니다. 대신 네이티브 CSS 스크롤 타임라인(`@scroll-timeline`)과 뷰 트랜지션 API(`document.startViewTransition()`)를 사용하여 GPU 가속을 받는 네이티브 애니메이션을 구현합니다.

### 4-6. 마테리얼리티(Materiality) 및 깊이감 디테일
다크 모드 UI가 밋밋하고 평면적으로 보이는 것을 막아야 합니다.
- **마이크로 쉰(Micro-sheens) & 서브픽셀 보더:** 모든 카드와 플로팅 컨테이너의 최상단 모서리(Top edge)에는 1픽셀 두께의 매우 희미한 빛 반사 하이라이트(`border-top: 1px solid rgba(255, 255, 255, 0.08)`)를 주어, 마치 유리가 빛을 받는 듯한 입체감을 부여합니다.
- **접근성(A11y)과 `inert`:** 모달이 떠 있거나 스크롤 바깥에 있어 비활성화된 슬라이드에는 네이티브 `inert` 속성을 부여해 탭 키(Tab) 이동 등에서 완전히 배제해야 합니다. 또한, 키보드로 접근 시 포커스 링(`focus-visible:outline-2 focus-visible:outline-offset-2`)을 명확하고 대비 높게 제공해야 합니다.

### 4-7. 2026 최고 수준의 렌더링 최적화
- **INP (Interaction to Next Paint) 방어:** 스크롤, 스와이프, 타이핑 시 메인 스레드를 50ms 이상 막지 않도록 최적화합니다. 무거운 렌더링이나 반복문은 React 렌더링 큐에서 분리하거나 `requestAnimationFrame` 등으로 넘기십시오.
- **`content-visibility`:** 캘린더나 피드 목록에 컴백 타일이 수십 개 렌더링될 경우, 화면 밖(Off-screen)에 있는 타일들에는 `content-visibility: auto`와 `contain-intrinsic-size`를 적용하여 브라우저가 화면 밖 요소의 레이아웃 계산을 아예 스킵하도록 강제합니다.
- **LCP 방어 및 Fetch Priority:** 페이지 최상단의 첫 번째 이미지(히어로 이미지, 상단 타일 6개 등)에는 반드시 `fetchpriority="high"`를 명시하여 브라우저가 가장 먼저 이미지를 다운받도록 합니다. 반면 화면 아래 보이지 않는 썸네일들은 `loading="lazy"`와 `fetchpriority="low"`를 부여하여 중요도를 낮춥니다.
"""

pattern = r"## 4\. 프론트엔드 UI/UX 정책.*?## 5\. Git Commit Guidelines"
replacement = new_section4 + "\n## 5. Git Commit Guidelines"

new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open("/Users/gimtaehun/idol_tracker/AGENTS.md", "w", encoding="utf-8", errors="surrogateescape") as f:
    f.write(new_content)

print("Section 4 updated successfully via python.")
