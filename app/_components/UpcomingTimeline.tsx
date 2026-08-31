"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  documentId,
} from "firebase/firestore";
import { db } from "../firebase";
import Link from "next/link";
import {
  FaBuilding,
  FaCommentDots,
  FaInstagram,
  FaTwitter,
  FaYoutube,
} from "react-icons/fa";
import type { Comeback } from "../../types";
import { ProcessedComeback } from "../_utils/calendarFilters";
import styles from "./UpcomingList.module.css";
import ComebackDialog from "./ComebackDialog";
import { getConfidenceIcon, isComebackReleased } from "./release-utils";

export default function UpcomingTimeline() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q") || "";

  const [upcoming, setUpcoming] = useState<ProcessedComeback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpcoming() {
      setLoading(true);
      try {
        const now = new Date();
        const startOfToday = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );

        const snapshot = await getDocs(
          query(
            collection(db, "comebacks"),
            where(
              "releaseDate",
              ">=",
              startOfToday.toISOString().split("T")[0],
            ),
            orderBy("releaseDate", "asc"),
            limit(10),
          ),
        );

        const upcomingComebacks = snapshot.docs.filter(doc => doc.data().status !== "NEEDS_REVIEW").map((doc) => ({
          ...(doc.data() as Comeback),
          id: doc.id,
        }));

        // Extract unique artist IDs for the upcoming comebacks
        const artistIds = Array.from(
          new Set(
            upcomingComebacks
              .map((c) => c.artistId)
              .filter((id) => id && !id.startsWith("UNKNOWN_")),
          ),
        );

        // Fetch only those specific artists
        const artistsMap = new Map();
        if (artistIds.length > 0) {
          // split into chunks of 10 if necessary, but realistically it's limit(10) so at most 10 artists
          const artistSnap = await getDocs(
            query(
              collection(db, "artists"),
              where(documentId(), "in", artistIds),
            ),
          );
          artistSnap.docs.forEach((doc) => {
            const data = doc.data();
            artistsMap.set(doc.id, data);
            if (data.name) {
              if (data.name.ko) artistsMap.set(data.name.ko, data);
              if (data.name.en) artistsMap.set(data.name.en, data);
            }
          });
        }

        const agencyIds = Array.from(
          new Set(
            Array.from(artistsMap.values())
              .map((a) => a.agencyId)
              .filter((id) => id),
          ),
        );

        const agenciesMap = new Map();
        if (agencyIds.length > 0) {
          const agencySnap = await getDocs(
            query(
              collection(db, "agencies"),
              where(documentId(), "in", agencyIds),
            ),
          );
          agencySnap.docs.forEach((doc) => {
            agenciesMap.set(doc.id, doc.data());
          });
        }

        const enriched = upcomingComebacks.map((c) => {
          const artistData =
            artistsMap.get(c.artistId) || artistsMap.get(c.artistName);
          const agencyData = artistData?.agencyId
            ? agenciesMap.get(artistData.agencyId)
            : null;
          return {
            ...c,
            dateObj: (c.releaseDate as any).toDate
              ? (c.releaseDate as any).toDate()
              : new Date(c.releaseDate),
            artistSns: artistData?.socialLinks || {},
            agency: agencyData,
          };
        });

        setUpcoming(enriched);
      } catch (err) {
        console.error("Failed to fetch upcoming timeline", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUpcoming();
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getTagClass = (type: string) => {
    if (!type) return styles.tagSingle;
    const t = type.toLowerCase();
    if (t === "full" || t === "정규") return styles.tagFull;
    if (t === "mini" || t === "ep" || t === "ep(미니)" || t === "미니")
      return styles.tagMini;
    return styles.tagSingle;
  };

  const filteredUpcoming = upcoming.filter((c) => {
    if (
      (c.artistName === "브브걸" || c.artistName === "BBGIRLS") &&
      c.dateObj.getFullYear() === 2026 &&
      c.dateObj.getMonth() === 6 &&
      c.dateObj.getDate() === 22
    ) {
      return false;
    }
    if (
      (c.artistName === "엠비오" || c.artistName === "AmbiO") &&
      c.dateObj.getFullYear() === 2026 &&
      c.dateObj.getMonth() === 6 &&
      c.dateObj.getDate() === 23
    ) {
      return false;
    }
    const artistMatch =
      c.artistName &&
      c.artistName.toLowerCase().includes(searchQuery.toLowerCase());
    const albumMatch = (c.titleTracks?.[0]?.name || c.albumTitle || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return !searchQuery || artistMatch || albumMatch;
  });

  return (
    <div className={`bento-card ${styles.timelineWrapper}`}>
      <h3 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: 700 }}>
        Upcoming {loading && "..."}
      </h3>

      {!loading && filteredUpcoming.length === 0 ? (
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
          No matching upcoming comebacks found.
        </p>
      ) : (
        filteredUpcoming.map((c) => (
          <div key={c.id} className={styles.timelineItem}>
            <Link
              href={`/comeback?id=${c.id}`}
              style={{ display: "block", flexShrink: 0 }}
            >
              {c.albumCoverUrl ||
              c.artistProfileImageUrl ||
              (c as any).officialImageUrl ? (
                <img
                  src={
                    c.albumCoverUrl ||
                    c.artistProfileImageUrl ||
                    (c as any).officialImageUrl
                  }
                  alt=""
                  className={styles.timelineThumbnail}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div
                  className={styles.timelineThumbnail}
                  style={{ background: "var(--border-color)" }}
                />
              )}
            </Link>

            <div className={styles.timelineContent}>
              <div className={styles.timelineDate}>
                {String(c.releaseDate).includes("TBA") || !c.dateObj || isNaN(c.dateObj.getTime())
                  ? (String(c.releaseDate).length > 4 ? String(c.releaseDate).replace("-TBA", "") + "월 중 (TBA)" : "TBA")
                  : formatDate(c.dateObj)}
              </div>

              <Link
                href={`/artist?id=${c.artistId}`}
                style={{ display: "block", maxWidth: "100%", overflow: "hidden" }}
              >
                <div className={styles.timelineArtist}>
                  {c.confidenceTier && !isComebackReleased(c) && (
                    <span
                      style={{ fontSize: "0.9em", marginRight: "4px" }}
                      title={`신뢰도: ${c.confidenceTier}`}
                    >
                      {getConfidenceIcon(c.confidenceTier, c)}
                    </span>
                  )}
                  {c.artistName}
                </div>
              </Link>

              <Link href={`/comeback?id=${c.id}`} style={{ display: "block" }}>
                <div className={styles.timelineTitle}>
                  <span
                    className={`${styles.tagBadge} ${getTagClass(c.releaseType)}`}
                  >
                    {c.releaseType}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
                    {c.titleTracks?.[0]?.name || c.albumTitle || "TBA"}
                  </span>
                </div>
              </Link>

              {/* SNS Links if available */}
              <div className={styles.snsLinks}>
                {c.mediaLinks?.musicVideo && (
                  <a
                    href={c.mediaLinks.musicVideo}
                    target="_blank"
                    rel="noreferrer"
                    title="Music Video"
                  >
                    <FaYoutube size={16} color="var(--accent-color)" />
                  </a>
                )}
                {!c.mediaLinks?.musicVideo && c.artistSns?.youtube && (
                  <a
                    href={c.artistSns.youtube}
                    target="_blank"
                    rel="noreferrer"
                    title="Official Channel"
                  >
                    <FaYoutube size={16} />
                  </a>
                )}
                {c.artistSns?.instagram && (
                  <a
                    href={c.artistSns.instagram}
                    target="_blank"
                    rel="noreferrer"
                    title="Instagram"
                  >
                    <FaInstagram size={16} />
                  </a>
                )}
                {c.artistSns?.twitter && (
                  <a
                    href={c.artistSns.twitter}
                    target="_blank"
                    rel="noreferrer"
                    title="Twitter"
                  >
                    <FaTwitter size={16} />
                  </a>
                )}
                {c.artistSns?.weverse && (
                  <a
                    href={c.artistSns.weverse}
                    target="_blank"
                    rel="noreferrer"
                    title="Weverse"
                  >
                    <FaCommentDots size={16} color="#00e5b0" />
                  </a>
                )}
                {c.agency && (
                  <span
                    className={styles.agencyBadge}
                    title={`Agency: ${c.agency.name}`}
                  >
                    <FaBuilding size={14} style={{ marginRight: "4px" }} />
                    <span>{c.agency.name}</span>
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
