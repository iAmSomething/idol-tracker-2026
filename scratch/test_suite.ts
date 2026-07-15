import { parseArticleWithQwen } from "../scripts/lib/qwen_extractor";

async function runTests() {
    const pubDate = "2026-07-14";
    
    const cases = [
        {
            name: "시크릿 (과거 컴백 예외)",
            title: "시크릿, 지난달 18일 컴백",
            text: "시크릿은 지난달 18일 컴백했다고 기사내용에도 나와있고 이번 방송에 출연한다.",
            check: (res: any) => !res.date || res.date < "2026-07-14"
        },
        {
            name: "에이티즈 (컴백 아님 예외)",
            title: "에이티즈 29일 일본 출국",
            text: "에이티즈가 오는 29일 일본 팬미팅을 위해 출국한다.",
            check: (res: any) => res.isMusicComeback === false || res.date === null
        },
        {
            name: "방탄소년단 진 (방송 복귀 예외)",
            title: "방탄소년단 진, 제대 후 29일 예능으로 컴백",
            text: "방탄소년단 진이 제대 후 오는 29일 인기 예능 프로그램에 출연하며 화려하게 컴백한다.",
            check: (res: any) => res.isMusicComeback === false || res.date === null
        }
    ];

    let passed = 0;
    for (const c of cases) {
        console.log(`\n=== 테스트: ${c.name} ===`);
        const result = await parseArticleWithQwen(c.text, c.title, pubDate);
        console.log("결과:", JSON.stringify(result));
        if (c.check(result)) {
            console.log("✅ 통과");
            passed++;
        } else {
            console.log("❌ 실패");
        }
    }
    console.log(`\n전체 테스트 결과: ${passed} / ${cases.length} 통과`);
}
runTests().catch(console.error);
