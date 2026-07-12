"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, doc, deleteDoc, addDoc } from "firebase/firestore";
import { db } from "../firebase";
import styles from "./Admin.module.css";

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
        title: "TBA",
        releaseDate: review.releaseDate,
        releaseType: review.releaseType,
        agencyName: "Unknown",
        createdAt: new Date().toISOString(),
      });

      await deleteDoc(doc(db, "pending_reviews", review.id));
      alert(`${review.artistName} 승인 완료!`);
    } catch (e: any) {
      alert("Error approving: " + e.message);
    }
  };

  const handleReject = async (review: any) => {
    try {
      await addDoc(collection(db, "crawler_feedbacks"), {
        action: 'rejected',
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
        <div key={r.id} className={styles.card}>
          <div className={styles.badge}>{r.type === 'new_artist' ? '🆕 신규 발굴' : '🔄 기존 아티스트 컴백'}</div>
          <h2 className={styles.artistName}>{r.artistName}</h2>
          <div className={styles.details}>
            <p><strong>발매일:</strong> {r.releaseDate}</p>
            <p><strong>형태:</strong> {r.releaseType}</p>
            {r.type === 'new_artist' && (
              <p><strong>아티스트 정보:</strong> {r.artistType} / {r.artistGender}</p>
            )}
            <p className={styles.source}><strong>출처 기사:</strong> {r.sourceTitle}</p>
          </div>
          <div className={styles.actions}>
            <button className={styles.approveBtn} onClick={() => handleApprove(r)}>Approve ✅</button>
            <button className={styles.rejectBtn} onClick={() => handleReject(r)}>Reject ❌</button>
          </div>
        </div>
      ))}
    </div>
  );
}
