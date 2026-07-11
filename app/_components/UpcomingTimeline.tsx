"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, limit, where, documentId } from "firebase/firestore";
import { db } from "../firebase";
import { Comeback } from "../../types";
import { FaYoutube, FaInstagram, FaTwitter, FaBuilding, FaCommentDots } from "react-icons/fa";
import Link from "next/link";

type ProcessedComeback = Comeback & { dateObj: Date; artistSns?: any; agency?: any };

export default function UpcomingTimeline({ searchQuery }: { searchQuery: string }) {
  const [upcoming, setUpcoming] = useState<ProcessedComeback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpcoming() {
      try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Fetch comebacks from today onwards
        const q = query(
          collection(db, "comebacks"),
          where("releaseDate", ">=", startOfToday.toISOString().split('T')[0]),
          orderBy("releaseDate", "asc"),
          limit(10)
        );
        
        const snapshot = await getDocs(q);
        const upcomingComebacks = snapshot.docs.map(doc => ({ ...doc.data() as Comeback, id: doc.id }));
        
        // Extract unique artist IDs for the upcoming comebacks
        const artistIds = Array.from(new Set(
          upcomingComebacks
            .map(c => c.artistId)
            .filter(id => id && !id.startsWith("UNKNOWN_"))
        ));

        // Fetch only those specific artists
        const artistsMap = new Map();
        if (artistIds.length > 0) {
          const artistSnap = await getDocs(
            query(collection(db, "artists"), where(documentId(), "in", artistIds))
          );
          artistSnap.docs.forEach(doc => {
            const data = doc.data();
            artistsMap.set(doc.id, data);
            // Also map by name for name-based lookup compatibility if needed
            if (data.name) {
              if (data.name.ko) artistsMap.set(data.name.ko, data);
              if (data.name.en) artistsMap.set(data.name.en, data);
            }
          });
        }

        // Extract unique agency IDs from the fetched artists
        const agencyIds = Array.from(new Set(
          Array.from(artistsMap.values())
            .map(a => a.agencyId)
            .filter(id => id)
        ));

        // Fetch only those specific agencies
        const agenciesMap = new Map();
        if (agencyIds.length > 0) {
          const agencySnap = await getDocs(
            query(collection(db, "agencies"), where(documentId(), "in", agencyIds))
          );
          agencySnap.docs.forEach(doc => {
            agenciesMap.set(doc.id, doc.data());
          });
        }

        const data: ProcessedComeback[] = upcomingComebacks.map(c => {
          // Attempt lookup by artistId first, fallback to artistName
          const artistData = artistsMap.get(c.artistId) || artistsMap.get(c.artistName);
          const agencyData = artistData?.agencyId ? agenciesMap.get(artistData.agencyId) : null;
          return {
            ...c,
            dateObj: (c.releaseDate as any).toDate ? (c.releaseDate as any).toDate() : new Date(c.releaseDate),
            artistSns: artistData?.socialLinks || {},
            agency: agencyData
          };
        });
        
        setUpcoming(data);
      } catch (err) {
        console.error("Failed to fetch upcoming timeline", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUpcoming();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTagClass = (type: string) => {
    if (!type) return 'tag-single';
    const t = type.toLowerCase();
    if (t === 'full' || t === '정규') return 'tag-full';
    if (t === 'mini' || t === 'ep' || t === 'ep(미니)' || t === '미니') return 'tag-mini';
    return 'tag-single';
  };

  const filteredUpcoming = upcoming.filter(c => {
    const artistMatch = c.artistName && c.artistName.toLowerCase().includes(searchQuery.toLowerCase());
    const albumMatch = (c.titleTracks?.[0]?.name || c.albumTitle || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return !searchQuery || artistMatch || albumMatch;
  });

  if (loading) return <div className="bento-card">Loading timeline...</div>;

  return (
    <div className="bento-card timeline-wrapper">
      <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: 700 }}>Upcoming</h3>
      
      {filteredUpcoming.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>No matching upcoming comebacks found.</p>
      ) : (
        filteredUpcoming.map((c) => (
          <div key={c.id} className="timeline-item" style={{ cursor: "default" }}>
             <Link href={`/comeback?id=${c.id}`} style={{ display: "block", flexShrink: 0 }}>
               {c.albumCoverUrl ? (
                  <img src={c.albumCoverUrl} alt="album cover" className="timeline-thumbnail" style={{ cursor: "pointer" }} />
               ) : (
                  <div className="timeline-thumbnail" style={{ background: "var(--border-color)", cursor: "pointer" }} />
               )}
             </Link>
             
             <div className="timeline-content" style={{ width: "100%" }}>
               <div className="timeline-date">{c.isTba ? `${c.dateObj.getFullYear()}년 ${c.dateObj.getMonth() + 1}월 중 (TBA)` : formatDate(c.dateObj)}</div>
               
               <Link href={`/artist?id=${c.artistId}`} style={{ display: 'inline-block', width: 'fit-content' }}>
                 <div className="timeline-artist" style={{ textDecoration: 'underline', cursor: "pointer" }}>{c.artistName}</div>
               </Link>
               
               <Link href={`/comeback?id=${c.id}`} style={{ display: 'block' }}>
                 <div className="timeline-title" style={{ cursor: "pointer" }}>
                   <span className={`tag-badge ${getTagClass(c.releaseType)}`}>{c.releaseType}</span>
                   {c.titleTracks?.[0]?.name || c.albumTitle || "TBA"}
                 </div>
               </Link>
               
               {/* SNS Links if available */}
               <div style={{ display: 'flex', gap: '8px', marginTop: '8px', color: 'var(--text-secondary)', alignItems: 'center' }}>
                 {c.mediaLinks?.musicVideo && (
                    <a href={c.mediaLinks.musicVideo} target="_blank" rel="noreferrer" title="Music Video">
                      <FaYoutube size={16} color="var(--accent-color)" />
                    </a>
                 )}
                 {!c.mediaLinks?.musicVideo && c.artistSns?.youtube && (
                    <a href={c.artistSns.youtube} target="_blank" rel="noreferrer" title="Official Channel">
                      <FaYoutube size={16} />
                    </a>
                 )}
                 {c.artistSns?.instagram && (
                    <a href={c.artistSns.instagram} target="_blank" rel="noreferrer" title="Instagram">
                      <FaInstagram size={16} />
                    </a>
                 )}
                 {c.artistSns?.twitter && (
                    <a href={c.artistSns.twitter} target="_blank" rel="noreferrer" title="Twitter">
                      <FaTwitter size={16} />
                    </a>
                 )}
                 {c.artistSns?.weverse && (
                    <a href={c.artistSns.weverse} target="_blank" rel="noreferrer" title="Weverse">
                      <FaCommentDots size={16} color="#00e5b0" />
                    </a>
                 )}
                 {c.agency && (
                    <span title={`Agency: ${c.agency.name}`} style={{ cursor: 'help', display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
                      <FaBuilding size={14} style={{ marginRight: '4px' }} />
                      <span style={{ fontSize: '0.7rem' }}>{c.agency.name}</span>
                    </span>
                 )}
               </div>
             </div>
          </div>
        ))
      )}
    </div>
  );
}
