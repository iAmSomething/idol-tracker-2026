"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import styles from "./Admin.module.css";

function ReviewCard({ r, handleApprove, handleReject }: { r: any, handleApprove: (r: any) => void, handleReject: (r: any, reason: string) => void }) {
  const [releaseDate, setReleaseDate] = useState(r.releaseDate);
  const [releaseType, setReleaseType] = useState(r.releaseType);
  const [albumTitle, setAlbumTitle] = useState(r.title || "TBA");
  const [rejectReason, setRejectReason] = useState("not_comeback");

  return (
    <div className={styles.card}>
      <div className={styles.badge}>{r.type === 'new_artist' ? '🆕 신규 발굴' : '🔄 기존 아티스트 컴백'}</div>
      <h2 className={styles.artistName}>{r.artistName}</h2>
      <div className={styles.details}>
        <p>
          <strong>앨범명: </strong> 
          <input 
            type="text" 
            value={albumTitle} 
            onChange={e => setAlbumTitle(e.target.value)} 
            placeholder="TBA"
            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #1f1e1c', background: '#0b0a09', color: '#f5f4f2', marginBottom: '8px' }}
          />
        </p>
        <p>
          <strong>발매일: </strong> 
          <input 
            type="text" 
            value={releaseDate} 
            onChange={e => setReleaseDate(e.target.value)} 
            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #1f1e1c', background: '#0b0a09', color: '#f5f4f2', marginBottom: '8px' }}
          />
        </p>
        <p>
          <strong>형태: </strong> 
          <select 
            value={releaseType} 
            onChange={e => setReleaseType(e.target.value)}
            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #1f1e1c', background: '#0b0a09', color: '#f5f4f2' }}
          >
            <option value="single">Single</option>
            <option value="mini">Mini (EP)</option>
            <option value="full">Full Album</option>
          </select>
        </p>
        {r.type === 'new_artist' && (
          <p><strong>아티스트 정보:</strong> {r.artistType} / {r.artistGender}</p>
        )}
        <p className={styles.source}><strong>출처 기사:</strong> {r.sourceTitle}</p>
      </div>
      <div className={styles.actions} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button className={styles.approveBtn} onClick={() => handleApprove({ ...r, releaseDate, releaseType, title: albumTitle })}>Approve ✅</button>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <select 
            value={rejectReason} 
            onChange={e => setRejectReason(e.target.value)}
            style={{ flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #1f1e1c', background: '#1a1917', color: '#f5f4f2' }}
          >
            <option value="not_comeback">컴백 기사 아님</option>
            <option value="member_name">멤버 이름으로 잘못 잡힘</option>
            <option value="false_positive">오탐지 (가수 아님)</option>
            <option value="expired">기간 지남</option>
            <option value="other">기타</option>
          </select>
          <button className={styles.rejectBtn} onClick={() => handleReject(r, rejectReason)} style={{ flex: 1 }}>Reject ❌</button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [reviews, setReviews] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pending_reviews"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReviews(data);
    });
    return () => unsub();
  }, []);

  const handleApprove = async (review: any) => {
    try {
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
        title: review.title || "TBA",
        releaseDate: review.releaseDate,
        releaseType: review.releaseType,
        agencyName: "Unknown",
        sourceLink: review.sourceLink || "",
        createdAt: new Date().toISOString(),
      });

      await deleteDoc(doc(db, "pending_reviews", review.id));
      alert(`${review.artistName} 승인 완료!`);
    } catch (e: any) {
      alert("Error approving: " + e.message);
    }
  };

  const handleReject = async (review: any, reason: string) => {
    try {
      await addDoc(collection(db, "crawler_feedbacks"), {
        action: 'rejected',
        reason: reason,
        originalData: review,
        rejectedAt: new Date().toISOString()
      });
      await deleteDoc(doc(db, "pending_reviews", review.id));
    } catch (e: any) {
      alert("Error rejecting: " + e.message);
    }
  };

  if (reviews.length === 0) {
    return <div className={styles.emptyState}>No pending reviews. You are all caught up! ✨</div>;
  }

  return (
    <div className={styles.grid}>
      {reviews.map((r) => (
        <ReviewCard key={r.id} r={r} handleApprove={handleApprove} handleReject={handleReject} />
      ))}
    </div>
  );
}
