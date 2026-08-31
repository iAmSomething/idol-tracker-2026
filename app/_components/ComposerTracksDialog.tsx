"use client";

import { collection, getDocs, limit, query, where } from "firebase/firestore";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaChevronRight,
  FaCompactDisc,
  FaMusic,
  FaStar,
  FaUsers,
} from "react-icons/fa";
import type { Track } from "../../types";
import {
  getComposerOverviewStats,
  getRelatedComposers,
  getTopCollaborators,
} from "../_lib/credit-analysis";
import { db } from "../firebase";
import styles from "./ComposerTracksDialog.module.css";

interface ComposerTracksDialogProps {
  composerName: string | null;
  onClose: () => void;
}

/**
 * 프로듀서 / 창작자 딥다이브 Bento-Grid 대시보드 모달
 *
 * [Architecture & SoC]
 * 복잡한 통계 계산은 `app/_lib/credit-analysis.ts`의 순수 함수에 위임하고,
 * 본 컴포넌트는 UI 렌더링 및 인터랙션에 집중합니다.
 */
export default function ComposerTracksDialog({
  composerName,
  onClose,
}: ComposerTracksDialogProps) {
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
        // 작곡가 배열 및 작사가 배열에서 함께 검색 시도 (우선 작곡가 쿼리)
        const q = query(
          collection(db, "tracks"),
          where("composers", "array-contains", composerName),
          limit(50),
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((doc) => doc.data() as Track);

        setTracks(data);
      } catch (err) {
        console.error("Failed to fetch composer tracks", err);
      } finally {
        setLoading(false);
      }
    }

    fetchComposerTracks();
  }, [composerName]);

  // 비즈니스 로직 순수 모듈을 활용한 통계 계산 (SoC 디커플링)
  const overviewStats = useMemo(
    () => getComposerOverviewStats(tracks),
    [tracks],
  );
  const topCollaborators = useMemo(
    () => getTopCollaborators(tracks, 3),
    [tracks],
  );
  const relatedComposers = useMemo(
    () => getRelatedComposers(tracks, composerName || "", 6),
    [tracks, composerName],
  );

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
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={styles.dialog}
    >
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h3 className={styles.title}>
            <FaMusic size={18} color="var(--accent-color)" />
            <span>
              <span className={styles.accent}>{composerName}</span> 프로듀서
              딥다이브
            </span>
          </h3>
          <span className={styles.subtitle}>
            크레딧 분석 및 아티스트 협업 네트워크 아카이브
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={styles.closeButton}
          title="모달 닫기"
        >
          닫기
        </button>
      </div>

      <div className={styles.contentContainer}>
        {loading ? (
          <div className={styles.emptyState}>
            <div className={styles.spinner} />
            <p>프로듀서 크레딧 및 참여 곡 네트워크를 분석 중...</p>
          </div>
        ) : tracks.length === 0 ? (
          <div className={styles.emptyState}>
            <p>등록된 크레딧 작업물을 찾을 수 없습니다.</p>
          </div>
        ) : (
          <>
            {/* 상단 1열: 종합 통계 타일 (3 Grid) */}
            <div className={styles.bentoGrid}>
              <div className={`${styles.bentoCard} ${styles.statCard}`}>
                <span className={styles.statLabel}>
                  <FaCompactDisc size={12} /> 총 참여 곡 수
                </span>
                <span className={styles.statValue}>
                  {overviewStats.totalTracks}
                  <span style={{ fontSize: "1rem", fontWeight: 500 }}> 곡</span>
                </span>
              </div>

              <div className={`${styles.bentoCard} ${styles.statCard}`}>
                <span className={styles.statLabel}>
                  <FaStar size={12} color="var(--accent-color)" /> 타이틀 곡
                  비중
                </span>
                <span
                  className={`${styles.statValue} ${styles.statValueAccent}`}
                >
                  {overviewStats.titleTracksCount}
                  <span style={{ fontSize: "1rem", fontWeight: 500 }}> 곡</span>
                </span>
              </div>

              <div className={`${styles.bentoCard} ${styles.statCard}`}>
                <span className={styles.statLabel}>
                  <FaUsers size={12} /> 협업 아티스트 수
                </span>
                <span className={styles.statValue}>
                  {overviewStats.uniqueArtistsCount}
                  <span style={{ fontSize: "1rem", fontWeight: 500 }}> 팀</span>
                </span>
              </div>
            </div>

            {/* 중단 2열: 협업 아티스트 TOP 3 & 연관 작곡가 칩 */}
            <div className={styles.bentoGrid}>
              <div className={`${styles.bentoCard} ${styles.colSpan2}`}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    <FaUsers size={14} color="var(--accent-color)" /> 최다 협업
                    아티스트 (Top Collaborators)
                  </span>
                </div>
                {topCollaborators.length > 0 ? (
                  <div className={styles.collabList}>
                    {topCollaborators.map((artist, idx) => (
                      <div
                        key={artist.artistName}
                        className={styles.collabItem}
                      >
                        <span className={styles.collabName}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            #{idx + 1}
                          </span>
                          {artist.artistName}
                        </span>
                        <span className={styles.collabBadge}>
                          {artist.count}곡 함께 작업
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyState}>
                    집계된 아티스트가 없습니다.
                  </p>
                )}
              </div>

              <div className={styles.bentoCard}>
                <div className={styles.sectionHeader}>
                  <span className={styles.sectionTitle}>
                    연관 프로듀서 네트워크
                  </span>
                </div>
                {relatedComposers.length > 0 ? (
                  <div className={styles.chipContainer}>
                    {relatedComposers.map((comp) => (
                      <div key={comp.composerName} className={styles.chip}>
                        <span>{comp.composerName}</span>
                        <span className={styles.chipCount}>{comp.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p
                    className={styles.emptyState}
                    style={{ padding: "10px 0" }}
                  >
                    단독 작업물
                  </p>
                )}
              </div>
            </div>

            {/* 하단 3열: 참여 곡 쇼케이스 타일 아카이브 */}
            <div className={styles.bentoCard}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle}>
                  <FaMusic size={14} color="var(--accent-color)" /> 참여 곡
                  아카이브 (Track Showcase)
                </span>
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                  }}
                >
                  총 {tracks.length}개 트랙
                </span>
              </div>

              <div className={styles.trackShowcase}>
                {tracks.map((t) => (
                  <Link
                    key={t.id || `${t.comebackId}-${t.name}`}
                    href={`/comeback?id=${t.comebackId}`}
                    onClick={onClose}
                    className={styles.trackTile}
                  >
                    <div className={styles.trackTileHeader}>
                      <h4 className={styles.trackName}>{t.name}</h4>
                      {t.isTitle && (
                        <span className={styles.titleBadge}>Title</span>
                      )}
                    </div>

                    <div className={styles.trackMeta}>
                      <span className={styles.trackArtist}>
                        {t.artistName || "아티스트 미상"}
                      </span>
                      <span className={styles.trackAlbum}>
                        {t.albumTitle || "앨범 미상"}
                      </span>
                    </div>

                    <div className={styles.trackLink}>
                      <span>앨범 상세 보기</span>
                      <FaChevronRight size={10} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
