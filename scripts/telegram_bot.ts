import * as path from "path";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import { db } from "./lib/firebase-helpers";
import { collection, onSnapshot, doc, deleteDoc, addDoc, getDoc } from "firebase/firestore";
import { logger } from "./lib/logger";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  logger.error("TELEGRAM_BOT_TOKEN is not defined in .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const chatIdStr = process.env.TELEGRAM_CHAT_ID;
const adminChatId = chatIdStr ? parseInt(chatIdStr) : null;

if (!adminChatId) {
  logger.error("TELEGRAM_CHAT_ID is not defined in .env");
  process.exit(1);
}

logger.info("Telegram Bot is running and polling for pending reviews...");

const notifiedIds = new Set<string>();

// Listen to Firestore pending_reviews
onSnapshot(collection(db, "pending_reviews"), (snapshot) => {
  snapshot.docChanges().forEach((change) => {
    if (change.type === "added") {
      const data = change.doc.data();
      const id = change.doc.id;
      
      if (notifiedIds.has(id)) return;
      notifiedIds.add(id);

      // We give it a small delay so we don't spam instantly on bulk insert
      setTimeout(() => {
        const text = `🔔 <b>신규 컴백/데뷔 검토 필요</b>\n\n` +
          `아티스트: <b>${data.artistName}</b>\n` +
          `유형: ${data.type === 'new_artist' ? '신규 발굴 🆕' : '기존 컴백 🔄'}\n` +
          `발매일: ${data.releaseDate}\n` +
          `형태: ${data.releaseType}\n` +
          (data.type === 'new_artist' ? `성별: ${data.artistGender} | 그룹/솔로: ${data.artistType}\n` : '') +
          `출처: <i>${data.sourceTitle}</i>\n\n` +
          `아래 버튼을 눌러 처리해주세요.`;

        bot.sendMessage(adminChatId, text, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ 통과", callback_data: `APPROVE_${id}` },
                { text: "✏️ 수정", callback_data: `EDIT_${id}` },
                { text: "❌ 거부", callback_data: `REJECT_${id}` }
              ]
            ]
          }
        });
      }, 1000);
    }
  });
});

// Handle button clicks
bot.on('callback_query', async (query) => {
  if (!query.data || !query.message) return;
  const action = query.data.split('_')[0];
  const docId = query.data.split('_').slice(1).join('_');
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;

  try {
    const reviewRef = doc(db, "pending_reviews", docId);
    const reviewSnap = await getDoc(reviewRef);

    if (!reviewSnap.exists()) {
      await bot.answerCallbackQuery(query.id, { text: "이미 처리된 항목입니다." });
      await bot.editMessageText(`✅ 처리된 항목입니다.`, { chat_id: chatId, message_id: messageId });
      return;
    }

    const review = reviewSnap.data();

    if (action === "APPROVE") {
      let artistId = review.artistId;
      if (review.type === 'new_artist') {
        const artistRef = await addDoc(collection(db, "artists"), {
          name: { ko: review.artistName, en: review.artistName },
          type: review.artistType || "group",
          gender: review.artistGender || "mixed",
          createdAt: new Date().toISOString()
        });
        artistId = artistRef.id;
      }

      await addDoc(collection(db, "comebacks"), {
        artistName: review.artistName,
        artistId: artistId,
        title: "TBA",
        releaseDate: review.releaseDate,
        releaseType: review.releaseType,
        agencyName: "Unknown",
        createdAt: new Date().toISOString(),
      });

      await deleteDoc(reviewRef);
      await bot.answerCallbackQuery(query.id, { text: "승인 완료!" });
      await bot.editMessageText(`✅ <b>${review.artistName}</b> 승인 및 등록이 완료되었습니다.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML"
      });
    } 
    else if (action === "REJECT") {
      await deleteDoc(reviewRef);
      await bot.answerCallbackQuery(query.id, { text: "거절 완료!" });
      await bot.editMessageText(`❌ <b>${review.artistName}</b> 데이터가 거절(삭제)되었습니다.`, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML"
      });
    }
    else if (action === "EDIT") {
      await bot.answerCallbackQuery(query.id);
      const editPrompt = `아래 양식을 복사해서 값을 수정한 뒤 답장으로 보내주세요:\n\n` +
        `--수정양식--\n` +
        `ID: ${docId}\n` +
        `Artist: ${review.artistName}\n` +
        `Date: ${review.releaseDate}\n` +
        `Type: ${review.releaseType}\n`;

      await bot.sendMessage(chatId, editPrompt);
    }
  } catch (e: any) {
    logger.error("Callback processing error:", e);
    await bot.answerCallbackQuery(query.id, { text: "오류가 발생했습니다." });
  }
});

// Handle text messages (for EDIT replies)
bot.on('message', async (msg) => {
  if (!msg.text || !msg.text.includes('--수정양식--')) return;

  try {
    const lines = msg.text.split('\n');
    let docId = '';
    let artistName = '';
    let releaseDate = '';
    let releaseType = '';

    for (const line of lines) {
      if (line.startsWith('ID: ')) docId = line.replace('ID: ', '').trim();
      if (line.startsWith('Artist: ')) artistName = line.replace('Artist: ', '').trim();
      if (line.startsWith('Date: ')) releaseDate = line.replace('Date: ', '').trim();
      if (line.startsWith('Type: ')) releaseType = line.replace('Type: ', '').trim();
    }

    if (!docId || !artistName) {
      await bot.sendMessage(msg.chat.id, "❌ 양식 파싱 실패. 정확히 복사해서 수정해주세요.");
      return;
    }

    const reviewRef = doc(db, "pending_reviews", docId);
    const reviewSnap = await getDoc(reviewRef);

    if (!reviewSnap.exists()) {
      await bot.sendMessage(msg.chat.id, "❌ 이미 처리되었거나 찾을 수 없는 항목입니다.");
      return;
    }

    const review = reviewSnap.data();
    
    // Register directly after edit
    let artistId = review.artistId;
    if (review.type === 'new_artist') {
      const artistRef = await addDoc(collection(db, "artists"), {
        name: { ko: artistName, en: artistName },
        type: review.artistType || "group",
        gender: review.artistGender || "mixed",
        createdAt: new Date().toISOString()
      });
      artistId = artistRef.id;
    }

    await addDoc(collection(db, "comebacks"), {
      artistName: artistName,
      artistId: artistId,
      title: "TBA",
      releaseDate: releaseDate,
      releaseType: releaseType,
      agencyName: "Unknown",
      createdAt: new Date().toISOString(),
    });

    await deleteDoc(reviewRef);
    await bot.sendMessage(msg.chat.id, `✅ <b>${artistName}</b> (수정됨) 승인 및 등록 완료!`, { parse_mode: 'HTML' });

  } catch (e: any) {
    logger.error("Edit processing error:", e);
    await bot.sendMessage(msg.chat.id, `❌ 수정 처리 중 오류 발생: ${e.message}`);
  }
});
