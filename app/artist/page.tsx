"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Artist, Comeback } from "../../types";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Link from "next/link";
import { FaYoutube, FaInstagram, FaTiktok, FaGlobe, FaArrowLeft, FaChevronRight, FaBuilding, FaUsers, FaUser, FaMusic } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import ThemeToggle from "../_components/ThemeToggle";

const WeverseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C6.48 2 2 6.12 2 11.2C2 14.28 3.86 16.96 6.74 18.56L6 21.6C5.9 22 6.2 22.3 6.6 22.1L10.3 20.2C10.85 20.33 11.42 20.4 12 20.4C17.52 20.4 22 16.28 22 11.2C22 6.12 17.52 2 12 2Z" fill="currentColor" />
    <path d="M9 9.5C9 8.67 9.67 8 10.5 8C11.33 8 12 8.67 12 9.5C12 10.33 11.33 11 10.5 11C9.67 11 9 10.33 9 9.5Z" fill="white" />
    <path d="M13.5 13.5C13.5 12.67 14.17 12 15 12C15.83 12 16.5 12.67 16.5 13.5C16.5 14.33 15.83 15 15 15C14.17 15 13.5 14.33 13.5 13.5Z" fill="white" />
  </svg>
);

function ArtistDetailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = searchParams.get("id");

  const [artist, setArtist] = useState<Artist | null>(null);
  const [comebacks, setComebacks] = useState<Comeback[]>([]);
  const [childArtists, setChildArtists] = useState<Artist[]>([]);
  const [agencyName, setAgencyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("올바르지 않은 접근입니다.");
      setLoading(false);
      return;
    }

    async function fetchArtistData() {
      try {
        setLoading(true);
        // 1. Fetch artist details
        const docRef = doc(db, "artists", id!);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          setError("아티스트를 찾을 수 없습니다.");
          return;
        }

        const artistData = { ...docSnap.data() as Artist, id: docSnap.id };
        setArtist(artistData);

        // 2. Fetch agency details if agencyId exists
        if (artistData.agencyId) {
          const agencySnap = await getDoc(doc(db, "agencies", artistData.agencyId));
          if (agencySnap.exists()) {
            setAgencyName((agencySnap.data() as any).name || "");
          }
        } else if (artistData.agency?.name) {
          setAgencyName(artistData.agency.name);
        }

        // 3. Fetch comebacks of this artist
        const q = query(
          collection(db, "comebacks"), 
          where("artistId", "==", id), 
          orderBy("releaseDate", "desc")
        );
        const comebacksSnap = await getDocs(q);
        const comebacksData = comebacksSnap.docs.map(d => ({ ...d.data() as Comeback, id: d.id }));
        setComebacks(comebacksData);

        // 4. Fetch child artists (solo/unit members) if this is a group
        if (artistData.type === 'group') {
          const childQ = query(
            collection(db, "artists"),
            where("parentGroupId", "==", id)
          );
          const childSnap = await getDocs(childQ);
          const childrenData = childSnap.docs.map(d => ({ ...d.data() as Artist, id: d.id }));
          setChildArtists(childrenData);
        }
      } catch (err) {
        console.error("Failed to fetch artist data", err);
        setError("데이터를 로드하는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchArtistData();
  }, [id]);

  if (loading) {
    return (
      <main className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>아티스트 정보를 불러오는 중...</p>
      </main>
    );
  }

  if (error || !artist) {
    return (
      <main className="app-container">
        <div className="bento-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>{error || "오류가 발생했습니다."}</p>
          <button onClick={() => router.push('/')} className="btn">홈으로 돌아가기</button>
        </div>
      </main>
    );
  }

  const getTagClass = (type: string) => {
    if (!type) return 'tag-single';
    const t = type.toLowerCase();
    if (t === 'full' || t === '정규') return 'tag-full';
    if (t === 'mini' || t === 'ep' || t === 'ep(미니)' || t === '미니') return 'tag-mini';
    return 'tag-single';
  };

  // Find the latest comeback that has a music video or teaser to embed
  const latestComebackWithMedia = comebacks.find(c => 
    c.mediaLinks?.musicVideo || 
    c.titleTracks?.[0]?.musicVideoUrl ||
    c.teasers?.[0]
  );

  const getYouTubeId = (url: string | undefined): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const latestMvCandidates = [
    latestComebackWithMedia?.mediaLinks?.musicVideo,
    latestComebackWithMedia?.titleTracks?.[0]?.musicVideoUrl,
    latestComebackWithMedia?.teasers?.[0]
  ];

  let youtubeId = null;
  for (const url of latestMvCandidates) {
    youtubeId = getYouTubeId(url);
    if (youtubeId) break;
  }
  const formattedLatestMvUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}` : null;

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
            <span>Artist</span>
            <FaChevronRight size={10} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{artist.name.ko || artist.name.en}</span>
          </nav>
        </div>
        <ThemeToggle />
      </header>

      {/* Bento Grid Layout */}
      <div className="detail-bento-grid">
        
        {/* Left Card: Artist Profile */}
        <div className="bento-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: 'fit-content' }}>
          {artist.profileImageUrl ? (
            <img 
              src={artist.profileImageUrl} 
              alt={artist.name.ko} 
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
              {artist.type === 'group' ? <FaUsers size={48} color="var(--text-secondary)" /> : <FaUser size={48} color="var(--text-secondary)" />}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
              <span className="filter-chip active" style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'default' }}>
                {artist.type === 'group' ? 'Group' : artist.type === 'solo' ? 'Solo' : 'Unit'}
              </span>
              {artist.gender && (
                <span style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'default', background: 'var(--surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', fontWeight: 600 }}>
                  {artist.gender === 'male' ? '남성 (Male)' : artist.gender === 'female' ? '여성 (Female)' : '혼성 (Mixed)'}
                </span>
              )}
              {artist.isActive ? (
                <span style={{ fontSize: '0.75rem', padding: '3px 8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', borderRadius: '4px', fontWeight: 600 }}>
                  Active
                </span>
              ) : (
                <span style={{ fontSize: '0.75rem', padding: '3px 8px', backgroundColor: 'var(--surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                  Inactive
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '2.2rem', fontWeight: 700, margin: '8px 0', lineHeight: 1.1 }}>
              {artist.name.ko}
            </h1>
            {artist.name.en && artist.name.en.toLowerCase() !== artist.name.ko.toLowerCase() && (
              <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>{artist.name.en}</p>
            )}

            {/* Basic Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
              {artist.parentGroupId && artist.parentGroupName && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.95rem' }}>
                  <FaUsers size={16} color="var(--text-secondary)" />
                  <span style={{ color: 'var(--text-secondary)', width: '70px' }}>소속 그룹</span>
                  <Link href={`/artist?id=${artist.parentGroupId}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'underline' }} className="hover:text-accent">
                    {artist.parentGroupName}
                  </Link>
                </div>
              )}
              {agencyName && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.95rem' }}>
                  <FaBuilding size={16} color="var(--text-secondary)" />
                  <span style={{ color: 'var(--text-secondary)', width: '70px' }}>소속사</span>
                  <span style={{ fontWeight: 600 }}>{agencyName}</span>
                </div>
              )}
              {artist.generation > 0 && (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.95rem' }}>
                  <FaUsers size={16} color="var(--text-secondary)" />
                  <span style={{ color: 'var(--text-secondary)', width: '70px' }}>세대</span>
                  <span style={{ fontWeight: 600 }}>{artist.generation}세대 K-Pop</span>
                </div>
              )}
            </div>

            {/* Child Artists (Solo / Unit) */}
            {childArtists.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600 }}>솔로 / 유닛 활동</h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {childArtists.map((child) => (
                    <Link key={child.id} href={`/artist?id=${child.id}`}>
                      <span className="btn hover:border-accent hover:text-accent" style={{ fontSize: '0.85rem', padding: '6px 12px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '6px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}>
                        {child.type === 'solo' ? <FaUser size={12} color="var(--text-secondary)" /> : <FaUsers size={12} color="var(--text-secondary)" />}
                        {child.name.ko}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Playlists / Digging */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px', fontWeight: 600 }}>아티스트 디깅 (전체 재생목록)</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a 
                  href={`https://music.youtube.com/search?q=${encodeURIComponent(artist.name.ko + ' 재생목록')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255, 0, 0, 0.1)',
                    color: '#FF0000',
                    borderColor: 'rgba(255, 0, 0, 0.2)',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  <FaYoutube size={16} /> YouTube Music
                </a>
                <a 
                  href={`https://www.melon.com/search/song/index.htm?q=${encodeURIComponent(artist.name.ko)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(0, 205, 60, 0.1)',
                    color: '#00CD3C',
                    borderColor: 'rgba(0, 205, 60, 0.2)',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  Melon (멜론)
                </a>
                <a 
                  href={`https://music.bugs.co.kr/search/track?q=${encodeURIComponent(artist.name.ko)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255, 60, 0, 0.1)',
                    color: '#FF3C00',
                    borderColor: 'rgba(255, 60, 0, 0.2)',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  Bugs (벅스)
                </a>
              </div>
            </div>

            {/* Aliases */}
            {artist.name.aliases && artist.name.aliases.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>활동명 / 별칭</h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {artist.name.aliases.map((alias, i) => (
                    <span key={i} style={{ fontSize: '0.8rem', padding: '4px 8px', backgroundColor: 'var(--surface-hover)', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Members */}
            {artist.members && artist.members.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }}>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>멤버 구성</h3>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {artist.members.map((member, i) => (
                    <span key={i} style={{ fontSize: '0.85rem', padding: '6px 12px', backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '6px', fontWeight: 500 }}>
                      {member.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: SNS Links & Comebacks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Top Bento Card: Social Media Links */}
          {artist.socialLinks && Object.values(artist.socialLinks).some(link => link) && (
            <div className="bento-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 600 }}>공식 SNS 채널</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {artist.socialLinks.youtube && (
                  <a 
                    href={artist.socialLinks.youtube} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'rgba(255, 0, 0, 0.1)', 
                      color: '#FF0000', 
                      borderColor: 'rgba(255, 0, 0, 0.2)',
                      fontWeight: 600
                    }}
                  >
                    <FaYoutube size={18} /> YouTube
                  </a>
                )}
                {artist.socialLinks.instagram && (
                  <a 
                    href={artist.socialLinks.instagram} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'rgba(225, 48, 108, 0.1)', 
                      color: '#E1306C', 
                      borderColor: 'rgba(225, 48, 108, 0.2)',
                      fontWeight: 600
                    }}
                  >
                    <FaInstagram size={18} /> Instagram
                  </a>
                )}
                {artist.socialLinks.x && (
                  <a 
                    href={artist.socialLinks.x} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.05)', 
                      color: 'var(--text-primary)', 
                      borderColor: 'var(--border-color)',
                      fontWeight: 600
                    }}
                  >
                    <FaXTwitter size={18} /> X (Twitter)
                  </a>
                )}
                {artist.socialLinks.tiktok && (
                  <a 
                    href={artist.socialLinks.tiktok} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.05)', 
                      color: 'var(--text-primary)', 
                      borderColor: 'var(--border-color)',
                      fontWeight: 600
                    }}
                  >
                    <FaTiktok size={18} /> TikTok
                  </a>
                )}
                {artist.socialLinks.weverse && (
                  <a 
                    href={artist.socialLinks.weverse} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'rgba(0, 229, 176, 0.1)', 
                      color: '#00E5B0', 
                      borderColor: 'rgba(0, 229, 176, 0.2)',
                      fontWeight: 600
                    }}
                  >
                    <WeverseIcon size={18} /> Weverse
                  </a>
                )}
                {artist.socialLinks.namuwiki && (
                  <a 
                    href={artist.socialLinks.namuwiki} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn"
                    style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'rgba(16, 185, 129, 0.1)', 
                      color: '#10B981', 
                      borderColor: 'rgba(16, 185, 129, 0.2)',
                      fontWeight: 600
                    }}
                  >
                    <FaGlobe size={18} /> 나무위키
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Middle Bento Card: Latest Youtube Comeback Video Embed */}
          {formattedLatestMvUrl && (
            <div className="bento-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FaYoutube color="#FF0000" /> 최신 컴백 미디어 피드
              </h3>
              <div style={{ aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <iframe
                  width="100%"
                  height="100%"
                  src={formattedLatestMvUrl}
                  title="Latest Comeback Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            </div>
          )}

          {/* Bottom Bento Card: Comebacks Timeline */}
          <div className="bento-card" style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', fontWeight: 600 }}>역대 컴백 및 발매 히스토리</h3>
            
            {comebacks.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', padding: '20px 0' }}>아직 등록된 컴백 일정이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {comebacks.map((c) => {
                  const releaseDateObj = new Date(c.releaseDate);
                  return (
                    <Link key={c.id} href={`/comeback?id=${c.id}`}>
                      <div className="track-item" style={{ 
                        display: 'flex', 
                        gap: '16px', 
                        alignItems: 'center',
                        padding: '14px 20px',
                        backgroundColor: 'var(--surface-hover)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}>
                        {c.albumCoverUrl ? (
                          <img 
                            src={c.albumCoverUrl} 
                            alt={(c as any).title} 
                            style={{ 
                              width: '50px', 
                              height: '50px', 
                              objectFit: 'cover', 
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)'
                            }}
                          />
                        ) : (
                          <div style={{ width: '50px', height: '50px', borderRadius: '6px', background: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FaMusic size={20} color="var(--text-secondary)" />
                          </div>
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                            {releaseDateObj.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                          </span>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                            {(c as any).title}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`tag-badge ${getTagClass(c.releaseType)}`} style={{ margin: 0 }}>
                            {c.releaseType}
                          </span>
                          <FaChevronRight size={12} color="var(--text-secondary)" />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </main>
  );
}

export default function ArtistDetailPage() {
  return (
    <Suspense fallback={
      <main className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>로딩 중...</p>
      </main>
    }>
      <ArtistDetailContent />
    </Suspense>
  );
}
