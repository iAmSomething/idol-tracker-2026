import { parseArticleWithQwen } from "../scripts/lib/qwen_extractor";

async function runTest() {
    const pubDate = "2026-07-14";
    const title = "아일릿 컴백 확정";
    const text = "아일릿의 새 싱글 ‘I Got Your Back’은 수많은 고민 속에서 성장해 나가는 소녀들의 서사를 담았다. 오는 7월 26일 전곡 음원이 선공개되며, 29일에는 ‘FRUiTS’와의 컬래버레이션 스페셜 에디션을 포함한 실물 음반이 정식 발매될 예정이다.";
    
    console.log("=== 테스트 1: 선공개일 우선, 앨범명 추출 테스트 ===");
    console.log("기사 내용:", text);
    console.log("AI 추출 중...");
    
    const result = await parseArticleWithQwen(text, title, pubDate);
    
    console.log("=== AI 추출 결과 ===");
    console.log(JSON.stringify(result, null, 2));

    if (result?.date === "2026-07-26" && result?.title === "I Got Your Back") {
        console.log("✅ 성공: 선공개일(26일)과 앨범명(I Got Your Back)이 완벽하게 추출되었습니다.");
    } else {
        console.log("❌ 실패: 추출 로직에 문제가 있습니다.");
    }
}

runTest().catch(console.error);
