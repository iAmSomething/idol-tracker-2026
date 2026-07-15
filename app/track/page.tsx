"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Track, Comeback } from "../../types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getYouTubeId } from "../_lib/youtube";
import Link from "next/link";
import { FaYoutube, FaArrowLeft, FaChevronRight, FaMusic, FaPlayCircle } from "react-icons/fa";
import ThemeToggle from "../_components/ThemeToggle";

function TrackDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [track, setTrack] = useState<Track | null>(null);
  const [comeback, setComeback] = useState<Comeback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("올바르지 않은 접근입니다.");
      setLoading(false);
      return;
    }

    async function fetchTrackData() {
      try {
        setLoading(true);
        // 1. Fetch track details
        const docRef = doc(db, "tracks", id!);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          setError("트랙 정보를 찾을 수 없습니다.");
          return;
        }

        const trackData = { ...docSnap.data() as Track, id: docSnap.id };
        setTrack(trackData);

        // 2. Fetch comeback details
        if (trackData.comebackId) {
          const cbRef = doc(db, "comebacks", trackData.comebackId);
          const cbSnap = await getDoc(cbRef);
          if (cbSnap.exists()) {
            setComeback({ ...cbSnap.data() as Comeback, id: cbSnap.id });
          }
        }
      } catch (err) {
        console.error("Failed to fetch track data", err);
        setError("데이터를 로드하는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchTrackData();
  }, [id]);

  if (loading) {
    return (
      <main className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>곡 상세 정보를 불러오는 중...</p>
      </main>
    );
  }

  if (error || !track) {
    return (
      <main className="app-container">
        <div className="bento-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>{error || "오류가 발생했습니다."}</p>
          <button onClick={() => router.push('/')} className="btn">홈으로 돌아가기</button>
        </div>
      </main>
    );
  }

  // Parse Youtube Video ID


  const youtubeId = getYouTubeId(track.musicVideoUrl);
  const formattedMvUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null;

  return (
    <main className="app-container">
      {/* Header & Navigation */}
      <header className="dashboard-header" style={{ alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.back()} className="btn" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FaArrowLeft size={14} /> 뒤로가기
          </button>
          
          <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
            <Link href="/" style={{ color: 'var(--text-secondary)' }}>Home</Link>
            <FaChevronRight size={10} />
            {comeback ? (
              <>
                <Link href={`/artist?id=${comeback.artistId}`} style={{ color: 'var(--text-secondary)' }}>{track.artistName}</Link>
                <FaChevronRight size={10} />
                <Link href={`/comeback?id=${track.comebackId}`} style={{ color: 'var(--text-secondary)' }}>{(track as any).title || (track as any).albumTitle}</Link>
                <FaChevronRight size={10} />
              </>
            ) : (
              <>
                <span>{track.artistName}</span>
                <FaChevronRight size={10} />
              </>
            )}
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{track.name}</span>
          </nav>
        </div>
        <ThemeToggle />
      </header>

      <div className="detail-bento-grid">
        
        {/* Left Card: Track Main Details */}
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'fit-content' }}>
          {comeback?.albumCoverUrl ? (
            <img 
              src={comeback.albumCoverUrl} 
              alt={(track as any).title} 
              style={{ 
                width: '100%', 
                aspectRatio: '1/1', 
                objectFit: 'cover', 
                borderRadius: '12px',
                boxShadow: 'var(--shadow-md)',
                border: '1px solid var(--border-color)'
              }}
            />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: '12px', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
              <FaMusic size={48} color="var(--text-secondary)" />
            </div>
          )}
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, lineHeight: 1.15 }}>
                {track.name}
              </h1>
              {track.isTitle && (
                <span style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: 'rgba(255, 107, 0, 0.1)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', borderRadius: '6px', fontWeight: 700, letterSpacing: '0.5px' }}>
                  TITLE
                </span>
              )}
            </div>

            {comeback ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Link href={`/artist?id=${comeback.artistId}`} style={{ display: 'inline-block' }}>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-color)', textDecoration: 'underline', fontWeight: 600 }}>
                    {track.artistName}
                  </h2>
                </Link>
                <Link href={`/comeback?id=${track.comebackId}`} style={{ display: 'inline-block' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                    {(track as any).title}
                  </h3>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-color)', fontWeight: 600 }}>{track.artistName}</h2>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{(track as any).title}</h3>
              </div>
            )}

            {track.duration && (
              <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                <FaPlayCircle />
                <span>{track.duration}</span>
              </div>
            )}
          </div>

          {/* Streaming Platforms */}
          {track.streamingLinks && Object.values(track.streamingLinks).some(link => link) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>음원 스트리밍</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(track.streamingLinks).map(([platform, link]) => {
                  if (!link) return null;
                  return (
                    <a 
                      key={platform} 
                      href={link as string} 
                      target="_blank" 
                      rel="noreferrer"
                      className="btn"
                      style={{ textTransform: 'capitalize', fontSize: '0.85rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      {platform}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Section: Media & Credits */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Top Bento Card: YouTube Media Embed */}
          {formattedMvUrl && (
            <div className="bento-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaYoutube color="var(--accent-color)" /> 뮤직비디오
              </h3>
              <div style={{ aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
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

          {/* Bottom Bento Card: Credits */}
          <div className="bento-card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', fontWeight: 600 }}>크레딧 (Credits)</h3>
            
            {(!track.composers || track.composers.length === 0) && (!track.lyricists || track.lyricists.length === 0) ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', padding: '20px 0' }}>등록된 크레딧 정보가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {track.composers && track.composers.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>작곡</h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {track.composers.map((comp, idx) => (
                        <span key={idx} style={{ padding: '6px 12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 500 }}>
                          {comp}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {track.lyricists && track.lyricists.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>작사</h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {track.lyricists.map((lyr, idx) => (
                        <span key={idx} style={{ padding: '6px 12px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.9rem', fontWeight: 500 }}>
                          {lyr}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}

export default function TrackDetailPage() {
  return (
    <Suspense fallback={
      <main className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>로딩 중...</p>
      </main>
    }>
      <TrackDetailContent />
    </Suspense>
  );
}
