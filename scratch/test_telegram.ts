import axios from 'axios';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const docId = "test_doc_id";

  const escapeHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  
  const text = `🔔 <b>신규 컴백/데뷔 검토 필요</b>\n\n` +
    `아티스트: <b>${escapeHtml("테스트 그룹")}</b>\n` +
    `유형: 신규 발굴 🆕\n` +
    `발매일: 2026-07-20\n` +
    `형태: mini\n` +
    `성별: mixed | 그룹/솔로: group\n` +
    `출처: <a href="https://v.daum.net/v/20260712">${escapeHtml("테스트 <기사> & 제목")}</a>\n\n` +
    `아래 버튼을 눌러 처리해주세요.`;

  try {
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ 통과", callback_data: `APPROVE_${docId}` },
            { text: "✏️ 수정", callback_data: `EDIT_${docId}` },
            { text: "❌ 거부", callback_data: `REJECT_${docId}` }
          ]
        ]
      }
    });
    console.log("Success:", res.data);
  } catch (e: any) {
    console.error("Error:", e.response ? JSON.stringify(e.response.data) : e.message);
  }
}

test();
