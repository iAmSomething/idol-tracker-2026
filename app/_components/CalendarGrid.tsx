"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import type { Comeback } from "../../types";
import { filterComebacks, ProcessedComeback } from "../_utils/calendarFilters";
import styles from "./CalendarGrid.module.css";
import ComebackDialog from "./ComebackDialog";
import { getConfidenceIcon, isComebackReleased } from "./release-utils";

export default function CalendarGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const searchQuery = searchParams.get("q") || "";
  const yearParam = searchParams.get("y");
  const monthParam = searchParams.get("m");

  const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
  const jsMonth = monthParam ? parseInt(monthParam) - 1 : new Date().getMonth();

  const [comebacks, setComebacks] = useState<ProcessedComeback[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedComeback, setSelectedComeback] =
    useState<ProcessedComeback | null>(null);
  const [filterType, setFilterType] = useState<
    "all" | "group" | "solo" | "unit"
  >("all");
  const [genderFilter, setGenderFilter] = useState<
    "all" | "male" | "female" | "mixed"
  >("all");

  const getDaysInMonth = (y: number, m: number) =>
    new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) =>
    new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, jsMonth);
  const firstDay = getFirstDayOfMonth(year, jsMonth);

  useEffect(() => {
    async function fetchComebacks() {
      setLoading(true);
      try {
        const daysInPrevMonth = getDaysInMonth(year, jsMonth - 1);
        const firstDay = getFirstDayOfMonth(year, jsMonth);
        const daysInMonth = getDaysInMonth(year, jsMonth);

        const startDate = new Date(
          year,
          jsMonth - 1,
          daysInPrevMonth - firstDay + 1,
        );
        const remainingCells = 42 - (firstDay + daysInMonth);
        const endDate = new Date(year, jsMonth + 1, remainingCells);

        const formatDateString = (d: Date) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        };

        const startStr = formatDateString(startDate);
        const endStr = formatDateString(endDate);

        const q = query(
          collection(db, "comebacks"),
          where("releaseDate", ">=", startStr),
          where("releaseDate", "<=", endStr),
          orderBy("releaseDate", "asc"),
        );
        const snapshot = await getDocs(q);
        const data: ProcessedComeback[] = snapshot.docs.filter((doc) => doc.data().status !== "NEEDS_REVIEW").map((doc) => {
          const d = doc.data() as Comeback;
          return {
            ...d,
            id: doc.id,
            dateObj: (d.releaseDate as any).toDate
              ? (d.releaseDate as any).toDate()
              : new Date(d.releaseDate),
          };
        });
        setComebacks(data);
      } catch (err) {
        console.error("Failed to fetch comebacks", err);
      } finally {
        setLoading(false);
      }
    }

    fetchComebacks();
  }, [year, jsMonth]);

  const prevMonth = () => {
    let newM = jsMonth - 1;
    let newY = year;
    if (newM < 0) {
      newM = 11;
      newY -= 1;
    }
    router.push(
      `/?q=${encodeURIComponent(searchQuery)}&y=${newY}&m=${newM + 1}`,
    );
  };

  const nextMonth = () => {
    let newM = jsMonth + 1;
    let newY = year;
    if (newM > 11) {
      newM = 0;
      newY += 1;
    }
    router.push(
      `/?q=${encodeURIComponent(searchQuery)}&y=${newY}&m=${newM + 1}`,
    );
  };

  const calendarCells = [];

  const daysInPrevMonth = getDaysInMonth(year, jsMonth - 1);
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push({
      date: new Date(year, jsMonth - 1, daysInPrevMonth - firstDay + i + 1),
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      date: new Date(year, jsMonth, i),
      isCurrentMonth: true,
    });
  }

  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      date: new Date(year, jsMonth + 1, i),
      isCurrentMonth: false,
    });
  }

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getReleaseClass = (type: string) => {
    if (!type) return styles.releaseSingle;
    const t = type.toLowerCase();
    if (t === "full" || t === "정규") return styles.releaseFull;
    if (t === "mini" || t === "ep" || t === "ep(미니)" || t === "미니")
      return styles.releaseMini;
    return styles.releaseSingle;
  };

  return (
    <div className={`bento-card ${styles.calendarWrapper}`}>
      <div className={styles.filtersWrapper}>
        <button
          className={`${styles.filterChip} ${filterType === "all" ? styles.active : ""}`}
          onClick={() => setFilterType("all")}
        >
          All
        </button>
        <button
          className={`${styles.filterChip} ${filterType === "group" ? styles.active : ""}`}
          onClick={() => setFilterType("group")}
        >
          Group
        </button>
        <button
          className={`${styles.filterChip} ${filterType === "solo" ? styles.active : ""}`}
          onClick={() => setFilterType("solo")}
        >
          Solo
        </button>
        <button
          className={`${styles.filterChip} ${filterType === "unit" ? styles.active : ""}`}
          onClick={() => setFilterType("unit")}
        >
          Unit
        </button>
      </div>
      <div className={styles.filtersWrapper} style={{ marginTop: "8px" }}>
        <button
          className={`${styles.filterChip} ${genderFilter === "all" ? styles.active : ""}`}
          onClick={() => setGenderFilter("all")}
        >
          성별 무관
        </button>
        <button
          className={`${styles.filterChip} ${genderFilter === "male" ? styles.active : ""}`}
          onClick={() => setGenderFilter("male")}
        >
          남성 (남돌/솔로)
        </button>
        <button
          className={`${styles.filterChip} ${genderFilter === "female" ? styles.active : ""}`}
          onClick={() => setGenderFilter("female")}
        >
          여성 (여돌/솔로)
        </button>
        <button
          className={`${styles.filterChip} ${genderFilter === "mixed" ? styles.active : ""}`}
          onClick={() => setGenderFilter("mixed")}
        >
          혼성
        </button>
      </div>

      <div className={styles.calendarHeader}>
        <button className={styles.btn} onClick={prevMonth}>
          &larr; Prev
        </button>
        <h2>
          {monthNames[jsMonth]} {year} {loading && "..."}
        </h2>
        <button className={styles.btn} onClick={nextMonth}>
          Next &rarr;
        </button>
      </div>

      <div className={styles.calendarWeekdays}>
        {weekDays.map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className={styles.calendarGrid}>
        {calendarCells.map((cell, idx) => {
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);

          const dayComebacks = filterComebacks(comebacks, {
            cellDate: cell.date,
            todayDate: todayDate,
            filterType,
            genderFilter,
            searchQuery,
          });

          return (
            <div
              key={idx}
              className={`${styles.calendarCell} ${!cell.isCurrentMonth ? styles.differentMonth : ""} ${isToday(cell.date) ? styles.today : ""}`}
            >
              <span className={styles.calendarDate}>{cell.date.getDate()}</span>

              <div
                style={{ display: "flex", flexDirection: "column", gap: "2px" }}
              >
                {dayComebacks.map((c) => {
                  return (
                    <button
                      key={c.id}
                      className={`${styles.eventPill} ${getReleaseClass(c.releaseType)}`}
                      onClick={() => setSelectedComeback(c)}
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
                          referrerPolicy="no-referrer"
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "4px",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "16px",
                            height: "16px",
                            background: "red",
                            borderRadius: "4px",
                          }}
                        />
                      )}
                      <span className={styles.eventArtist}>
                        {c.confidenceTier &&
                          !isComebackReleased(c) && (
                            <span
                              className={styles.moonIcon}
                              title={`신뢰도: ${c.confidenceTier}`}
                            >
                              {getConfidenceIcon(c.confidenceTier, c)}
                            </span>
                          )}
                        {c.isTba ? `[TBA] ${c.artistName}` : c.artistName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ComebackDialog
        comeback={selectedComeback}
        onClose={() => setSelectedComeback(null)}
      />
    </div>
  );
}
