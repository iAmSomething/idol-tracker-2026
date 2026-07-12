import { NextResponse } from 'next/server';
import { db } from '../../firebase';
import { doc, getDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTg(method: string, payload: any) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.callback_query) {
      const query = body.callback_query;
      const dataStr = query.data || '';
      const chatId = query.message.chat.id;
      const messageId = query.message.message_id;

      const [action, ...rest] = dataStr.split('_');
      const docId = rest.join('_');

      if (!action || !docId) {
        return NextResponse.json({ ok: true });
      }

      const reviewRef = doc(db, 'pending_reviews', docId);
      const reviewSnap = await getDoc(reviewRef);

      if (!reviewSnap.exists()) {
        await sendTg('answerCallbackQuery', { callback_query_id: query.id, text: '이미 처리되었거나 삭제된 항목입니다.' });
        await sendTg('editMessageText', { chat_id: chatId, message_id: messageId, text: '✅ 이미 처리된 항목입니다.' });
        return NextResponse.json({ ok: true });
      }

      const review = reviewSnap.data();

      if (action === 'APPROVE') {
        let artistId = review.artistId;
        if (review.type === 'new_artist') {
          const artistRef = await addDoc(collection(db, 'artists'), {
            name: { ko: review.artistName, en: review.artistName },
            type: review.artistType || 'group',
            gender: review.artistGender || 'mixed',
            createdAt: new Date().toISOString()
          });
          artistId = artistRef.id;
        }

        await addDoc(collection(db, 'comebacks'), {
          artistName: review.artistName,
          artistId: artistId,
          title: 'TBA',
          releaseDate: review.releaseDate,
          releaseType: review.releaseType,
          agencyName: 'Unknown',
          createdAt: new Date().toISOString(),
        });

        await deleteDoc(reviewRef);
        await sendTg('answerCallbackQuery', { callback_query_id: query.id, text: '승인 완료!' });
        await sendTg('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: `✅ <b>${review.artistName}</b> 승인 및 등록이 완료되었습니다.`,
          parse_mode: 'HTML'
        });
      } 
      else if (action === 'REJECT') {
        // Save to crawler_feedbacks
        await addDoc(collection(db, 'crawler_feedbacks'), {
          action: 'rejected',
          originalData: review,
          rejectedAt: new Date().toISOString()
        });

        await deleteDoc(reviewRef);
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

      return NextResponse.json({ ok: true });
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
          return NextResponse.json({ ok: true });
        }

        const reviewRef = doc(db, 'pending_reviews', docId);
        const reviewSnap = await getDoc(reviewRef);

        if (!reviewSnap.exists()) {
          await sendTg('sendMessage', { chat_id: chatId, text: '❌ 이미 처리되었거나 찾을 수 없는 항목입니다.' });
          return NextResponse.json({ ok: true });
        }

        const review = reviewSnap.data();

        // Save to crawler_feedbacks
        await addDoc(collection(db, 'crawler_feedbacks'), {
          action: 'edited',
          originalData: review,
          editedData: { artistName, releaseDate, releaseType },
          editedAt: new Date().toISOString()
        });

        // Register
        let artistId = review.artistId;
        if (review.type === 'new_artist') {
          const artistRef = await addDoc(collection(db, 'artists'), {
            name: { ko: artistName, en: artistName },
            type: review.artistType || 'group',
            gender: review.artistGender || 'mixed',
            createdAt: new Date().toISOString()
          });
          artistId = artistRef.id;
        }

        await addDoc(collection(db, 'comebacks'), {
          artistName: artistName,
          artistId: artistId,
          title: 'TBA',
          releaseDate: releaseDate,
          releaseType: releaseType,
          agencyName: 'Unknown',
          createdAt: new Date().toISOString(),
        });

        await deleteDoc(reviewRef);
        await sendTg('sendMessage', { chat_id: chatId, text: `✅ <b>${artistName}</b> (수정됨) 승인 완료 및 피드백 저장 완료!`, parse_mode: 'HTML' });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Webhook Error:', e);
    return NextResponse.json({ ok: false, error: e.message });
  }
}
