"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Comeback, Track } from "../../types";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../firebase";
import Link from "next/link";
import { FaYoutube, FaArrowLeft, FaChevronRight, FaMusic } from "react-icons/fa";
import ThemeToggle from "../_components/ThemeToggle";
import ComposerTracksDialog from "../_components/ComposerTracksDialog";

function ComebackDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [comeback, setComeback] = useState<Comeback | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
    if (!id) {
      setError("올바르지 않은 접근입니다.");
      setLoading(false);
      return;
    }

    async function fetchComebackData() {
      try {
        setLoading(true);
        // 1. Fetch comeback details
        const docRef = doc(db, "comebacks", id!);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          setError("컴백 일정을 찾을 수 없습니다.");
          return;
        }

        const comebackData = { ...docSnap.data() as Comeback, id: docSnap.id };
        setComeback(comebackData);

        // 2. Fetch tracks details
        const q = query(collection(db, "tracks"), where("comebackId", "==", id));
        const tracksSnap = await getDocs(q);
        const tracksData = tracksSnap.docs.map(d => ({ ...d.data(), id: d.id } as Track));
        tracksData.sort((a, b) => a.id.localeCompare(b.id));
        setTracks(tracksData);
      } catch (err) {
        console.error("Failed to fetch comeback data", err);
        setError("데이터를 로드하는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchComebackData();
  }, [id]);

  if (loading) {
    return (
      <main className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>컴백 상세 정보를 불러오는 중...</p>
      </main>
    );
  }

  if (error || !comeback) {
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

  const dateObj = new Date(comeback.releaseDate);

  const getTagClass = (type: string) => {
    if (!type) return 'tag-single';
    const t = type.toLowerCase();
    if (t === 'full' || t === '정규') return 'tag-full';
    if (t === 'mini' || t === 'ep' || t === 'ep(미니)' || t === '미니') return 'tag-mini';
    return 'tag-single';
  };

  return (
    <>
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
            <span>Comeback</span>
            <FaChevronRight size={10} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{(comeback as any).title || comeback.albumTitle}</span>
          </nav>
        </div>
        <ThemeToggle />
      </header>

      {/* Bento Grid Details Layout */}
      <div className="detail-bento-grid">
        
        {/* Left Card: Album Main Details */}
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'fit-content' }}>
          {comeback.albumCoverUrl ? (
            <img 
              src={comeback.albumCoverUrl} 
              alt={(comeback as any).title} 
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
            <Link href={`/artist?id=${comeback.artistId}`} style={{ display: 'inline-block', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--accent-color)', textDecoration: 'underline', fontWeight: 600 }}>
                {comeback.artistName}
              </h2>
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0 16px 0', lineHeight: 1.15 }}>
              {(comeback as any).title}
            </h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>발매일</span>
                <span style={{ fontWeight: 600 }}>
                  {comeback.isTba 
                    ? `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 중 (TBA)` 
                    : dateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)' }}>앨범 구분</span>
                <span className={`tag-badge ${getTagClass(comeback.releaseType)}`} style={{ margin: 0, fontSize: '0.75rem', padding: '4px 8px' }}>
                  {comeback.releaseType}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>소속사</span>
                <span style={{ fontWeight: 600 }}>{comeback.agencyName}</span>
              </div>
            </div>
          </div>

          {/* Streaming Platforms */}
          {comeback.streamingLinks && Object.values(comeback.streamingLinks).some(link => link) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>음원 스트리밍</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.entries(comeback.streamingLinks).map(([platform, link]) => {
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

        {/* Right Section: Media & Tracklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Top Bento Card: YouTube Media Embed */}
          {formattedMvUrl && (
            <div className="bento-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaYoutube color="var(--accent-color)" /> 타이틀곡 뮤직비디오 / 티저
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

          {/* AI Summary & News */}
          {(comeback.aiSummary || (comeback.recentNews && comeback.recentNews.length > 0)) && (
            <div className="bento-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✨ 컴백 프리뷰 & 관련 기사
              </h3>
              
              {comeback.aiSummary && (
                <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.95rem', lineHeight: 1.6, color: 'var(--text-primary)', borderLeft: '3px solid var(--accent-color)' }}>
                  {comeback.aiSummary}
                </div>
              )}

              {comeback.recentNews && comeback.recentNews.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600 }}>관련 기사 (최근 검색 기준)</span>
                  {comeback.recentNews.map((news, idx) => (
                    <a key={idx} href={news.link} target="_blank" rel="noreferrer" className="track-item hover:border-accent" style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-hover)', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>{news.title}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{new Date(news.pubDate).toLocaleDateString('ko-KR')}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bottom Bento Card: Tracklist */}
          <div className="bento-card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', fontWeight: 600 }}>수록곡 리스트 (Tracklist)</h3>
            
            {tracks.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', padding: '20px 0' }}>등록된 수록곡 정보가 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tracks.map((track, idx) => (
                  <div key={idx} className="track-item" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '14px 20px',
                    backgroundColor: 'var(--surface-hover)',
                    border: track.isTitle ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span className="text-secondary" style={{ width: '20px', fontWeight: 600 }}>{idx + 1}</span>
                        <Link href={`/track?id=${track.id}`} style={{ fontWeight: track.isTitle ? 600 : 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'underline', textUnderlineOffset: '4px' }} className="hover:text-accent">
                          {track.name}
                        </Link>
                        {track.isTitle && (
                          <span style={{ fontSize: '0.65rem', padding: '3px 6px', backgroundColor: 'rgba(255, 107, 0, 0.1)', color: 'var(--accent-color)', border: '1px solid var(--accent-color)', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.5px' }}>
                            TITLE
                          </span>
                        )}
                        {track.musicVideoUrl && (
                          <a href={track.musicVideoUrl} target="_blank" rel="noreferrer" title="Music Video" style={{ display: 'flex', alignItems: 'center', color: 'var(--accent-color)', flexShrink: 0 }}>
                            <FaYoutube size={16} />
                          </a>
                        )}
                      </div>
                      
                      {/* Composers & Lyricists */}
                      {(track.composers || track.lyricists) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px", paddingLeft: "36px", marginTop: "4px" }}>
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
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                      {track.streamingLinks && Object.entries(track.streamingLinks).map(([platform, link]) => {
                        if (!link) return null;
                        return (
                          <a key={platform} href={link as string} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', textTransform: 'capitalize', color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                            {platform}
                          </a>
                        );
                      })}
                      {track.duration && <span className="text-secondary" style={{ fontSize: '0.85rem' }}>{track.duration}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
    <ComposerTracksDialog composerName={selectedComposer} onClose={() => setSelectedComposer(null)} />
    </>
  );
}

export default function ComebackDetailPage() {
  return (
    <Suspense fallback={
      <main className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>로딩 중...</p>
      </main>
    }>
      <ComebackDetailContent />
    </Suspense>
  );
}
