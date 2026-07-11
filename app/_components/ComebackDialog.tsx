"use client";

import { useEffect, useRef, useState } from "react";
import { Comeback, Track } from "../../types";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase";
import { FaYoutube } from "react-icons/fa";
import Link from "next/link";
import ComposerTracksDialog from "./ComposerTracksDialog";

interface ComebackDialogProps {
  comeback: (Comeback & { dateObj: Date }) | null;
  onClose: () => void;
}

export default function ComebackDialog({ comeback, onClose }: ComebackDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [selectedComposer, setSelectedComposer] = useState<string | null>(null);
  const [clickableComposers, setClickableComposers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (tracks.length === 0) return;
    const uniqueComposers = new Set<string>();
    for (const t of tracks) {
      if (t.composers) {
        for (const c of t.composers) {
          uniqueComposers.add(c);
        }
      }
    }
    for (const comp of Array.from(uniqueComposers)) {
      if (clickableComposers[comp] !== undefined) continue;
      (async () => {
        try {
          const q = query(collection(db, "tracks"), where("composers", "array-contains", comp), limit(2));
          const snap = await getDocs(q);
          setClickableComposers(prev => ({
            ...prev,
            [comp]: snap.size >= 2
          }));
        } catch (e) {
          console.error(e);
        }
      })();
    }
  }, [tracks]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (comeback) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      dialog.close();
      document.body.style.overflow = "auto";
    }
    
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [comeback]);

  useEffect(() => {
    if (comeback) {
      setLoadingTracks(true);
      const q = query(collection(db, "tracks"), where("comebackId", "==", comeback.id));
      getDocs(q).then(snap => {
        const t = snap.docs.map(d => d.data() as Track);
        // Sort tracks by id or just keep order if possible, though id might be comebackId-track-0
        t.sort((a, b) => a.id.localeCompare(b.id));
        setTracks(t);
      }).catch(err => console.error(err))
      .finally(() => setLoadingTracks(false));
    } else {
      setTracks([]);
    }
  }, [comeback]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!comeback) return null;

  const getYouTubeId = (url: string | undefined): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const mvUrl = comeback.mediaLinks?.musicVideo || 
                tracks.find(t => t.isTitle && t.musicVideoUrl)?.musicVideoUrl || 
                tracks.find(t => t.musicVideoUrl)?.musicVideoUrl || 
                comeback.mediaLinks?.teasers?.[0] ||
                comeback.titleTracks?.[0]?.musicVideoUrl;
  const youtubeId = getYouTubeId(mvUrl);
  const formattedMvUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null;

  return (
    <>
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={handleBackdropClick}
    >
      <div style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column" }}>
        
        {/* Header - Clean White */}
        <div style={{ 
          padding: "32px 32px 24px 32px", 
          borderBottom: "1px solid var(--border-color)",
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "flex-start", 
          gap: "16px" 
        }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", gap: "24px", alignItems: "center" }}>
            {comeback.albumCoverUrl && (
              <img 
                src={comeback.albumCoverUrl} 
                alt="Cover" 
                style={{ 
                  width: "120px", height: "120px", 
                  objectFit: "cover", 
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
                }} 
              />
            )}
            <div>
              <Link 
                href={`/artist?id=${comeback.artistId}`}
                onClick={onClose}
                className="text-secondary"
                style={{ 
                  display: "inline-block",
                  margin: "0 0 8px 0", 
                  fontSize: "0.95rem", 
                  fontWeight: 600, 
                  textTransform: "uppercase", 
                  letterSpacing: "0.5px",
                  cursor: "pointer",
                  textDecoration: "underline"
                }}
              >
                {comeback.artistName}
              </Link>
              <h2 style={{ 
                margin: 0, fontSize: "2.2rem", lineHeight: "1.1", 
                color: "var(--text-primary)"
              }}>
                {comeback.albumTitle}
              </h2>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <Link 
              href={`/comeback?id=${comeback.id}`}
              onClick={onClose}
              className="btn"
              style={{ 
                display: "inline-flex", 
                alignItems: "center",
                backgroundColor: "rgba(255, 107, 0, 0.1)", 
                color: "var(--accent-color)", 
                borderColor: "var(--accent-color)" 
              }}
            >
              자세히 보기
            </Link>
            <button 
              onClick={onClose} 
              className="btn"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "32px", maxHeight: "65vh", overflowY: "auto", backgroundColor: "var(--surface-color)" }}>
        
        {/* Metadata Badges */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "32px" }}>
          <span style={{ fontSize: "0.85rem", padding: "6px 12px", backgroundColor: "#fff", border: "1px solid var(--border-color)", borderRadius: "6px", fontWeight: 600, color: "var(--text-primary)" }}>
            {comeback.isTba 
              ? `${comeback.dateObj.getFullYear()}년 ${comeback.dateObj.getMonth() + 1}월 중 (TBA)` 
              : comeback.dateObj.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <span style={{ fontSize: "0.85rem", padding: "6px 12px", backgroundColor: "#fff", border: "1px solid var(--border-color)", borderRadius: "6px", textTransform: "capitalize", fontWeight: 600, color: "var(--text-secondary)" }}>
            {comeback.releaseType}
          </span>
          <span style={{ fontSize: "0.85rem", padding: "6px 12px", backgroundColor: "#fff", border: "1px solid var(--border-color)", borderRadius: "6px", fontWeight: 600, color: "var(--text-secondary)" }}>
            {comeback.agencyName}
          </span>
        </div>

        {/* Music Video / Media */}
        {formattedMvUrl && (
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Music Video</h3>
            <div style={{ aspectRatio: "16/9", backgroundColor: "#e5e7eb", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
              <iframe
                width="100%"
                height="100%"
                src={formattedMvUrl}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )}

        {/* Tracklist */}
        {loadingTracks ? (
          <div style={{ padding: "20px", textAlign: "center" }}>Loading tracks...</div>
        ) : tracks.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Tracklist</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {tracks.map((track, idx) => (
                <div key={idx} style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center",
                  padding: "16px 20px",
                  backgroundColor: "#fff",
                  border: track.isTitle ? "1px solid var(--accent-color)" : "1px solid var(--border-color)",
                  borderRadius: "8px",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span className="text-secondary" style={{ width: "24px", fontWeight: 600 }}>{idx + 1}</span>
                      <span style={{ fontWeight: track.isTitle ? 600 : 500, color: track.isTitle ? "var(--text-primary)" : "var(--text-secondary)" }}>
                        {track.name}
                      </span>
                      {track.isTitle && (
                        <span style={{ fontSize: "0.7rem", padding: "4px 8px", backgroundColor: "#eff6ff", color: "var(--accent-color)", border: "1px solid #bfdbfe", borderRadius: "4px", fontWeight: 700, letterSpacing: "0.5px" }}>
                          TITLE
                        </span>
                      )}
                      {track.musicVideoUrl && (
                        <a href={track.musicVideoUrl} target="_blank" rel="noreferrer" title="Music Video" style={{ display: "flex", alignItems: "center", color: "var(--accent-color)" }}>
                          <FaYoutube size={16} />
                        </a>
                      )}
                    </div>
                    
                    {/* Composers & Lyricists */}
                    {(track.composers || track.lyricists) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "40px", marginTop: "4px" }}>
                        {track.composers && track.composers.length > 0 && (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            <span style={{ fontWeight: 600 }}>작곡:</span>{" "}
                            {track.composers.map((comp, cIdx) => {
                              const isClickable = clickableComposers[comp];
                              return (
                                <span key={cIdx}>
                                  {cIdx > 0 && ", "}
                                  <span
                                    onClick={() => isClickable && setSelectedComposer(comp)}
                                    style={{
                                      textDecoration: isClickable ? "underline" : "none",
                                      cursor: isClickable ? "pointer" : "default",
                                      color: isClickable ? "var(--accent-color)" : "inherit",
                                      fontWeight: isClickable ? 600 : 400
                                    }}
                                    title={isClickable ? "다른 작곡 곡 보기" : ""}
                                  >
                                    {comp}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {track.lyricists && track.lyricists.length > 0 && (
                          <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                            <span style={{ fontWeight: 600 }}>작사:</span>{" "}
                            <span>{track.lyricists.join(", ")}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {track.streamingLinks && Object.entries(track.streamingLinks).map(([platform, link]) => {
                      if (!link) return null;
                      return (
                        <a key={platform} href={link as string} target="_blank" rel="noreferrer" style={{ fontSize: "0.75rem", textTransform: "capitalize", color: "var(--text-secondary)", textDecoration: "underline" }}>
                          {platform}
                        </a>
                      );
                    })}
                    {track.duration && <span className="text-secondary" style={{ fontSize: "0.9rem", fontWeight: 500 }}>{track.duration}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Streaming Links */}
        {comeback.streamingLinks && Object.values(comeback.streamingLinks).some(link => link) && (
          <div>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "16px", fontWeight: 600, color: "var(--text-primary)" }}>Listen On</h3>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              {Object.entries(comeback.streamingLinks).map(([platform, link]) => {
                if (!link) return null;
                return (
                  <a 
                    key={platform} 
                    href={link as string} 
                    target="_blank" 
                    rel="noreferrer"
                    className="btn"
                    style={{ textTransform: "capitalize", fontWeight: 600 }}
                  >
                    {platform}
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </dialog>
    <ComposerTracksDialog composerName={selectedComposer} onClose={() => setSelectedComposer(null)} />
    </>
  );
}
