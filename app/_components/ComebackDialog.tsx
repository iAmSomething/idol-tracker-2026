"use client";

import { collection, getDocs, limit, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FaYoutube } from "react-icons/fa";
import { SiApplemusic, SiSpotify, SiYoutubemusic } from "react-icons/si";
import type { Comeback, Track } from "../../types";
import { getYouTubeId } from "../_lib/youtube";
import { db } from "../firebase";
import styles from "./ComebackDialog.module.css";
import ComposerTracksDialog from "./ComposerTracksDialog";
import { getConfidenceIcon, isComebackReleased } from "./release-utils";

interface ComebackDialogProps {
  comeback: (Comeback & { dateObj: Date }) | null;
  onClose: () => void;
}

export default function ComebackDialog({
  comeback,
  onClose,
}: ComebackDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [selectedComposer, setSelectedComposer] = useState<string | null>(null);
  const [clickableComposers, setClickableComposers] = useState<
    Record<string, boolean>
  >({});
  const [expandedTracks, setExpandedTracks] = useState<Record<string, boolean>>(
    {},
  );

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
          const q = query(
            collection(db, "tracks"),
            where("composers", "array-contains", comp),
            limit(2),
          );
          const snap = await getDocs(q);
          setClickableComposers((prev) => ({
            ...prev,
            [comp]: snap.size >= 2,
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

  const [errorTracks, setErrorTracks] = useState<string | null>(null);

  useEffect(() => {
    if (comeback) {
      setLoadingTracks(true);
      setErrorTracks(null);
      const q = query(
        collection(db, "tracks"),
        where("comebackId", "==", comeback.id),
      );
      getDocs(q)
        .then((snap) => {
          const t = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Track);
          // Sort tracks by trackNumber
          t.sort((a, b) => a.trackNumber - b.trackNumber);
          setTracks(t);
        })
        .catch((err) => {
          console.error(err);
          setErrorTracks(err.message || "Failed to load tracks");
        })
        .finally(() => setLoadingTracks(false));
    } else {
      setTracks([]);
      setErrorTracks(null);
    }
  }, [comeback]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  if (!comeback) return null;

  const mvCandidates = [
    comeback.mediaLinks?.musicVideo,
    tracks.find((t) => t.isTitle && t.musicVideoUrl)?.musicVideoUrl,
    tracks.find((t) => t.musicVideoUrl)?.musicVideoUrl,
    comeback.mediaLinks?.teasers?.[0],
    comeback.titleTracks?.[0]?.musicVideoUrl,
  ];

  let youtubeId = null;
  for (const url of mvCandidates) {
    youtubeId = getYouTubeId(url);
    if (youtubeId) break;
  }
  const formattedMvUrl = youtubeId
    ? `https://www.youtube.com/embed/${youtubeId}`
    : null;

  return (
    <>
      <dialog
        ref={dialogRef}
        onClose={onClose}
        onClick={handleBackdropClick}
        className={styles.dialog}
      >
        <div className={styles.dialogContainer}>
          {/* Header - Clean White */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              {(comeback.albumCoverUrl ||
                comeback.artistProfileImageUrl ||
                (comeback as any).officialImageUrl) && (
                <img
                  src={
                    comeback.albumCoverUrl ||
                    comeback.artistProfileImageUrl ||
                    (comeback as any).officialImageUrl
                  }
                  alt="Cover"
                  className={styles.albumCover}
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                {comeback.parentGroupName && (
                  comeback.parentGroupId ? (
                    <Link
                      href={`/artist?id=${comeback.parentGroupId}`}
                      onClick={onClose}
                      className={styles.groupLink}
                    >
                      {comeback.parentGroupName}
                    </Link>
                  ) : (
                    <span className={styles.groupLink} style={{ cursor: 'default' }}>
                      {comeback.parentGroupName}
                    </span>
                  )
                )}
                <Link
                  href={`/artist?id=${comeback.artistId}`}
                  onClick={onClose}
                  className={styles.artistLink}
                >
                  {comeback.artistName}
                </Link>
                <h2 className={styles.title}>
                  {comeback.albumTitle}
                </h2>
              </div>
            </div>

            <div className={styles.headerRight}>
              <Link
                href={`/comeback?id=${comeback.id}`}
                onClick={onClose}
                className={styles.detailBtn}
              >
                자세히 보기
              </Link>
              <button onClick={onClose} className={styles.closeBtn}>
                Close
              </button>
            </div>
          </div>
        </div>

        <div className={styles.contentBody}>
          {/* Metadata Badges */}
          <div className={styles.badgesWrapper}>
            <span className={styles.badge}>
              {comeback.isTba
                ? `${comeback.dateObj.getFullYear()}년 ${comeback.dateObj.getMonth() + 1}월 중 (TBA)`
                : comeback.dateObj.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
            </span>
            <span className={styles.badgeSecondary}>
              {comeback.releaseType}
            </span>
            {comeback.agencyName && comeback.agencyName !== "Unknown" && (
              <span className={styles.badgeSecondary}>
                {comeback.agencyName}
              </span>
            )}
          </div>

          {/* Confidence Info / Source Article Link for Future Comebacks */}
          {!isComebackReleased(comeback) &&
            ((comeback.confidenceTier &&
              comeback.confidenceTier !== "RELEASED") ||
              comeback.sourceLink ||
              (comeback.recentNews && comeback.recentNews.length > 0)) && (
              <div className={styles.sourceWarning}>
                {comeback.confidenceTier &&
                !isComebackReleased(comeback) ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                      }}
                    >
                      <h3
                        className={styles.sourceWarningTitle}
                        style={{ marginBottom: 0 }}
                      >
                        <span style={{ marginRight: "6px" }}>
                          {getConfidenceIcon(comeback.confidenceTier, comeback)}
                        </span>
                        신뢰도: {comeback.confidenceTier} (
                        {comeback.confidenceScore}점)
                      </h3>
                    </div>
                    <p className={styles.sourceWarningText}>
                      {comeback.dateObj.getTime() <
                      new Date().setHours(0, 0, 0, 0)
                        ? "예정일이 지났으나 발매가 확인되지 않은 일정입니다."
                        : "봇이 수집한 근거를 바탕으로 산출된 컴백 신뢰도입니다."}
                    </p>

                    {comeback.confidenceReasons &&
                    comeback.confidenceReasons.length > 0 ? (
                      <ul className={styles.reasonList}>
                        {comeback.confidenceReasons.map(
                          (r: any, idx: number) => {
                            const reasonText =
                              typeof r === "string" ? r : r.reason;
                            const sourceUrl =
                              typeof r === "string" ? undefined : r.sourceUrl;
                            return (
                              <li key={idx} className={styles.reasonItem}>
                                <span className={styles.reasonText}>
                                  {reasonText}
                                </span>
                                {sourceUrl && (
                                  <a
                                    href={sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.reasonLink}
                                    title={sourceUrl}
                                  >
                                    [근거 자료 ↗]
                                  </a>
                                )}
                              </li>
                            );
                          },
                        )}
                      </ul>
                    ) : /* Fallback to recentNews */
                    comeback.recentNews && comeback.recentNews.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {comeback.recentNews.map((news, idx) => (
                          <a
                            key={idx}
                            href={news.link}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.sourceLink}
                            title={news.title}
                          >
                            📰{" "}
                            {news.title
                              ? news.title.length > 50
                                ? news.title.substring(0, 50) + "..."
                                : news.title
                              : "뉴스 기사 원문 보기"}
                          </a>
                        ))}
                      </div>
                    ) : (
                      comeback.sourceLink && (
                        <a
                          href={comeback.sourceLink}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.sourceLink}
                        >
                          📰 뉴스 기사 원문 보기
                        </a>
                      )
                    )}
                  </>
                ) : (
                  /* Legacy fallback */
                  <>
                    <h3 className={styles.sourceWarningTitle}>
                      컴백 추정 근거
                    </h3>
                    <p className={styles.sourceWarningText}>
                      {comeback.dateObj.getTime() <
                      new Date().setHours(0, 0, 0, 0)
                        ? "컴백 예정일이 지났으나 아직 공식 음원이 확인되지 않은 일정(또는 오탐지)입니다. 봇이 수집한 아래 뉴스 기사를 참고하세요."
                        : "아직 앨범이 발매되지 않은 예정된 컴백입니다. 봇이 수집한 아래 뉴스 기사에서 컴백 일정을 유추했습니다."}
                    </p>
                    {comeback.recentNews && comeback.recentNews.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                        }}
                      >
                        {comeback.recentNews.map((news, idx) => (
                          <a
                            key={idx}
                            href={news.link}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.sourceLink}
                            title={news.title}
                          >
                            📰{" "}
                            {news.title
                              ? news.title.length > 50
                                ? news.title.substring(0, 50) + "..."
                                : news.title
                              : "뉴스 기사 원문 보기"}
                          </a>
                        ))}
                      </div>
                    ) : (
                      comeback.sourceLink && (
                        <a
                          href={comeback.sourceLink}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.sourceLink}
                        >
                          📰 뉴스 기사 원문 보기
                        </a>
                      )
                    )}
                  </>
                )}
              </div>
            )}

          {/* Music Video / Media */}
          {formattedMvUrl && (
            <div style={{ marginBottom: "32px" }}>
              <h3 className={styles.sectionTitle}>Music Video</h3>
              <div className={styles.mvContainer}>
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
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--text-secondary)",
              }}
            >
              Loading tracks...
            </div>
          ) : errorTracks ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "var(--color-accent)",
              }}
            >
              Error: {errorTracks}
            </div>
          ) : (
            tracks.length > 0 && (
              <div style={{ marginBottom: "32px" }}>
                <h3 className={styles.sectionTitle}>Tracklist</h3>
                <div className={styles.trackList}>
                  {tracks.map((track, idx) => (
                    <div
                      key={idx}
                      className={`${styles.trackItem} ${track.isTitle ? styles.trackItemTitle : ""}`}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "16px",
                          }}
                        >
                          <span className={styles.trackIndex}>{idx + 1}</span>
                          <Link
                            href={`/track?id=${track.id}`}
                            className={
                              track.isTitle
                                ? styles.trackNameTitle
                                : styles.trackName
                            }
                          >
                            {track.name}
                          </Link>
                          {track.isTitle && (
                            <span className={styles.titleBadge}>TITLE</span>
                          )}
                          {track.musicVideoUrl && (
                            <a
                              href={track.musicVideoUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Music Video"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                color: "var(--accent-color)",
                              }}
                            >
                              <FaYoutube size={16} />
                            </a>
                          )}
                        </div>

                        {/* Composers */}
                        {track.composers &&
                          track.composers.length > 0 &&
                          (() => {
                            const isExpanded = expandedTracks[track.id];
                            const visibleComposers = isExpanded
                              ? track.composers
                              : track.composers.slice(0, 2);
                            const hasMore = track.composers.length > 2;

                            return (
                              <div className={styles.composerSection}>
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    color: "var(--text-secondary)",
                                    display: "flex",
                                    flexWrap: "wrap",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>작곡:</span>
                                  {visibleComposers.map((comp, cIdx) => {
                                    const isClickable =
                                      clickableComposers[comp];
                                    return (
                                      <span
                                        key={cIdx}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                        }}
                                      >
                                        {cIdx > 0 && (
                                          <span style={{ marginRight: "4px" }}>
                                            ,
                                          </span>
                                        )}
                                        <span
                                          onClick={() =>
                                            isClickable &&
                                            setSelectedComposer(comp)
                                          }
                                          style={{
                                            textDecoration: isClickable
                                              ? "underline"
                                              : "none",
                                            cursor: isClickable
                                              ? "pointer"
                                              : "default",
                                            color: isClickable
                                              ? "var(--accent-color)"
                                              : "inherit",
                                            fontWeight: isClickable ? 600 : 400,
                                          }}
                                          title={
                                            isClickable
                                              ? "다른 작곡 곡 보기"
                                              : ""
                                          }
                                        >
                                          {comp}
                                        </span>
                                      </span>
                                    );
                                  })}
                                  {hasMore && (
                                    <button
                                      onClick={() =>
                                        setExpandedTracks((prev) => ({
                                          ...prev,
                                          [track.id]: !isExpanded,
                                        }))
                                      }
                                      style={{
                                        background: "none",
                                        border: "none",
                                        padding: "0 4px",
                                        fontSize: "0.75rem",
                                        color: "var(--text-secondary)",
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                        marginLeft: "2px",
                                      }}
                                    >
                                      {isExpanded ? "접기" : "더보기"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        {track.streamingLinks &&
                          Object.entries(track.streamingLinks).map(
                            ([platform, link]) => {
                              if (!link) return null;
                              return (
                                <a
                                  key={platform}
                                  href={link as string}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    fontSize: "0.75rem",
                                    textTransform: "capitalize",
                                    color: "var(--text-secondary)",
                                    textDecoration: "underline",
                                  }}
                                >
                                  {platform}
                                </a>
                              );
                            },
                          )}
                        {track.duration && (
                          <span
                            style={{
                              fontSize: "0.9rem",
                              fontWeight: 500,
                              color: "var(--text-secondary)",
                            }}
                          >
                            {track.duration}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* Streaming Links */}
          {comeback.streamingLinks &&
            Object.values(comeback.streamingLinks).some((link) => link) && (
              <div>
                <h3 className={styles.sectionTitle}>Listen On</h3>
                <div className={styles.streamingPlatforms}>
                  {Object.entries(comeback.streamingLinks).map(
                    ([platform, link]) => {
                      if (!link) return null;

                      let icon = null;
                      let bgColor = "var(--surface-color)";
                      let textColor = "var(--text-primary)";
                      let displayPlatform = platform;

                      switch (platform) {
                        case "youtubeMusic":
                          icon = <SiYoutubemusic size={18} />;
                          bgColor = "#FF0000";
                          textColor = "#FFFFFF";
                          displayPlatform = "YouTube Music";
                          break;
                        case "appleMusic":
                          icon = <SiApplemusic size={18} />;
                          bgColor = "#FA243C";
                          textColor = "#FFFFFF";
                          displayPlatform = "Apple Music";
                          break;
                        case "melon":
                          bgColor = "#00CD3C";
                          textColor = "#FFFFFF";
                          displayPlatform = "Melon";
                          break;
                        case "spotify":
                          icon = <SiSpotify size={18} />;
                          bgColor = "#1DB954";
                          textColor = "#FFFFFF";
                          displayPlatform = "Spotify";
                          break;
                        case "bugs":
                          bgColor = "#FF3C00";
                          textColor = "#FFFFFF";
                          displayPlatform = "Bugs";
                          break;
                      }

                      return (
                        <a
                          key={platform}
                          href={link as string}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.streamingBtn}
                          style={{ backgroundColor: bgColor, color: textColor }}
                        >
                          {icon} {displayPlatform}
                        </a>
                      );
                    },
                  )}
                </div>
              </div>
            )}
        </div>
      </dialog>
      <ComposerTracksDialog
        composerName={selectedComposer}
        onClose={() => setSelectedComposer(null)}
      />
    </>
  );
}
