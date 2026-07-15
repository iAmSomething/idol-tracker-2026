"use client";

import { useEffect, useRef, useState } from "react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase";
import { Track } from "../../types";
import Link from "next/link";
import { FaMusic, FaChevronRight } from "react-icons/fa";

interface ComposerTracksDialogProps {
  composerName: string | null;
  onClose: () => void;
}

export default function ComposerTracksDialog({ composerName, onClose }: ComposerTracksDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (composerName) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [composerName]);

  useEffect(() => {
    if (!composerName) {
      setTracks([]);
      return;
    }

    async function fetchComposerTracks() {
      setLoading(true);
      try {
        const q = query(
          collection(db, "tracks"),
          where("composers", "array-contains", composerName),
          limit(50)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => doc.data() as Track);
        
        // Filter out current duplicate track IDs if necessary, or just list all
        setTracks(data);
      } catch (err) {
        console.error("Failed to fetch composer tracks", err);
      } finally {
        setLoading(false);
      }
    }

    fetchComposerTracks();
  }, [composerName]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!composerName) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
      style={{
        width: "90%",
        maxWidth: "500px",
        borderRadius: "var(--radius-soft)",
        backgroundColor: "var(--surface-color)",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-lg)",
        padding: "24px",
        color: "var(--text-primary)",
        outline: "none"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
        <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
          <span style={{ color: "var(--accent-color)" }}>{composerName}</span> 작곡가의 대표 곡
        </h3>
        <button 
          onClick={onClose} 
          className="btn"
          style={{ padding: "4px 10px", fontSize: "0.85rem" }}
        >
          닫기
        </button>
      </div>

      <div style={{ maxHeight: "40vh", overflowY: "auto" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>곡 목록을 불러오는 중...</p>
        ) : tracks.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--text-secondary)", padding: "20px" }}>등록된 다른 곡이 없습니다.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {tracks.map((t, idx) => (
              <div 
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  backgroundColor: "var(--surface-hover)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                }}
              >
                <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FaMusic size={14} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.name}
                  </h4>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                    <span>{t.artistName || "아티스트 미상"}</span>
                    <span>•</span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(t as any).albumTitle || (t as any).title || "앨범 미상"}
                    </span>
                  </div>
                </div>
                <Link 
                  href={`/comeback?id=${t.comebackId}`}
                  onClick={onClose}
                  className="btn"
                  style={{ padding: "6px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
                  title="앨범 상세 보기"
                >
                  <FaChevronRight size={10} />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </dialog>
  );
}
