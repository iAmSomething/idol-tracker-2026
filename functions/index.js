const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Note: To use environment variables like TELEGRAM_BOT_TOKEN in Cloud Functions v2,
// we should ideally use defineString from firebase-functions/params, but reading
// process.env works if we deploy with --set-env-vars.
// We will rely on process.env for simplicity.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTg(method, payload) {
  if (!BOT_TOKEN) return;
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    console.error(`Telegram API Error: ${response.status} ${await response.text()}`);
  }
}

exports.telegramWebhook = onRequest(async (req, res) => {
  try {
    const body = req.body;

    if (body.callback_query) {
      const query = body.callback_query;
      const dataStr = query.data || '';
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;

      const parts = dataStr.split('_');
      const action = parts[0];
      const docId = parts.slice(1).join('_');

      if (!action || !docId) {
        return res.status(200).send("OK");
      }

      const reviewRef = db.collection('pending_reviews').doc(docId);
      const reviewSnap = await reviewRef.get();

      if (!reviewSnap.exists) {
        await sendTg('answerCallbackQuery', { callback_query_id: query.id, text: '이미 처리되었거나 삭제된 항목입니다.' });
        await sendTg('editMessageText', { chat_id: chatId, message_id: messageId, text: '✅ 이미 처리된 항목입니다.' });
        return res.status(200).send("OK");
      }

      const review = reviewSnap.data();

      if (action === 'APPROVE') {
        let artistId = review.artistId;
        if (review.type === 'new_artist') {
          const artistRef = await db.collection('artists').add({
            name: { ko: review.artistName, en: review.artistName },
            type: review.artistType || 'group',
            gender: review.artistGender || 'mixed',
            createdAt: new Date().toISOString()
          });
          artistId = artistRef.id;
        }

        await db.collection('comebacks').add({
          artistName: review.artistName,
          artistId: artistId,
          title: 'TBA',
          releaseDate: review.releaseDate,
          releaseType: review.releaseType,
          agencyName: 'Unknown',
          createdAt: new Date().toISOString(),
        });

        await reviewRef.delete();
        await sendTg('answerCallbackQuery', { callback_query_id: query.id, text: '승인 완료!' });
        await sendTg('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ <b>${review.artistName}</b> 승인 및 등록이 완료되었습니다.`,
          parse_mode: 'HTML'
        });
      } 
      else if (action === 'REJECT') {
        await db.collection('crawler_feedbacks').add({
          action: 'rejected',
          originalData: review,
          rejectedAt: new Date().toISOString()
        });

        await reviewRef.delete();
        await sendTg('answerCallbackQuery', { callback_query_id: query.id, text: '거절 완료!' });
        await sendTg('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `❌ <b>${review.artistName}</b> 데이터가 거절 및 학습용으로 저장되었습니다.`,
          parse_mode: 'HTML'
        });
      }
      else if (action === 'EDIT') {
        await sendTg('answerCallbackQuery', { callback_query_id: query.id });
        const editPrompt = `아래 양식을 복사해서 값을 수정한 뒤 답장으로 보내주세요:\n\n` +
          `--수정양식--\n` +
          `ID: ${docId}\n` +
          `Artist: ${review.artistName}\n` +
          `Date: ${review.releaseDate}\n` +
          `Type: ${review.releaseType}\n`;

        await sendTg('sendMessage', { chat_id: chatId, text: editPrompt });
      }

      return res.status(200).send("OK");
    }

    if (body.message && body.message.text) {
      const text = body.message.text;
      const chatId = body.message.chat.id;

      if (text.includes('--수정양식--')) {
        const lines = text.split('\n');
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
          await sendTg('sendMessage', { chat_id: chatId, text: '❌ 양식 파싱 실패. 정확히 복사해서 수정해주세요.' });
          return res.status(200).send("OK");
        }

        const reviewRef = db.collection('pending_reviews').doc(docId);
        const reviewSnap = await reviewRef.get();

        if (!reviewSnap.exists) {
          await sendTg('sendMessage', { chat_id: chatId, text: '❌ 이미 처리되었거나 찾을 수 없는 항목입니다.' });
          return res.status(200).send("OK");
        }

        const review = reviewSnap.data();

        await db.collection('crawler_feedbacks').add({
          action: 'edited',
          originalData: review,
          editedData: { artistName, releaseDate, releaseType },
          editedAt: new Date().toISOString()
        });

        let artistId = review.artistId;
        if (review.type === 'new_artist') {
          const artistRef = await db.collection('artists').add({
            name: { ko: artistName, en: artistName },
            type: review.artistType || 'group',
            gender: review.artistGender || 'mixed',
            createdAt: new Date().toISOString()
          });
          artistId = artistRef.id;
        }

        await db.collection('comebacks').add({
          artistName: artistName,
          artistId: artistId,
          title: 'TBA',
          releaseDate: releaseDate,
          releaseType: releaseType,
          agencyName: 'Unknown',
          createdAt: new Date().toISOString(),
        });

        await reviewRef.delete();
        await sendTg('sendMessage', { chat_id: chatId, text: `✅ <b>${artistName}</b> (수정됨) 승인 완료 및 피드백 저장 완료!`, parse_mode: 'HTML' });
      }
    }

    return res.status(200).send("OK");
  } catch (e) {
    console.error('Webhook Error:', e);
    return res.status(500).send("Error");
  }
});
