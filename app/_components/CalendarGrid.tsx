"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { db } from "../firebase";
import ComebackDialog from "./ComebackDialog";
import { Comeback } from "../../types";

type ProcessedComeback = Comeback & { dateObj: Date };

export default function CalendarGrid({ searchQuery }: { searchQuery: string }) {
  const [comebacks, setComebacks] = useState<ProcessedComeback[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedComeback, setSelectedComeback] = useState<ProcessedComeback | null>(null);
  const [filterType, setFilterType] = useState<"all" | "group" | "solo" | "unit">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female" | "mixed">("all");
  
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 6, 1)); 

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  useEffect(() => {
    async function fetchComebacks() {
      setLoading(true);
      try {
        const daysInPrevMonth = getDaysInMonth(year, month - 1);
        const firstDay = getFirstDayOfMonth(year, month);
        const daysInMonth = getDaysInMonth(year, month);
        
        // Calculate calendar cell start and end dates
        const startDate = new Date(year, month - 1, daysInPrevMonth - firstDay + 1);
        const remainingCells = 42 - (firstDay + daysInMonth);
        const endDate = new Date(year, month + 1, remainingCells);

        const formatDateString = (d: Date) => {
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };

        const startStr = formatDateString(startDate);
        const endStr = formatDateString(endDate);

        const q = query(
          collection(db, "comebacks"),
          where("releaseDate", ">=", startStr),
          where("releaseDate", "<=", endStr),
          orderBy("releaseDate", "asc")
        );
        const snapshot = await getDocs(q);
        const data: ProcessedComeback[] = snapshot.docs.map(doc => {
          const d = doc.data() as Comeback;
          return {
            ...d,
            id: doc.id,
            dateObj: (d.releaseDate as any).toDate ? (d.releaseDate as any).toDate() : new Date(d.releaseDate)
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
  }, [currentMonth]);

  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const calendarCells = [];
  
  const daysInPrevMonth = getDaysInMonth(year, month - 1);
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push({
      date: new Date(year, month - 1, daysInPrevMonth - firstDay + i + 1),
      isCurrentMonth: false,
    });
  }
  
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    calendarCells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const isToday = (d: Date) => {
    const today = new Date(); 
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const getReleaseClass = (type: string) => {
    if (!type) return 'release-single';
    const t = type.toLowerCase();
    if (t === 'full' || t === '정규') return 'release-full';
    if (t === 'mini' || t === 'ep' || t === 'ep(미니)' || t === '미니') return 'release-mini';
    return 'release-single';
  };

  return (
    <div className="calendar-wrapper bento-card">
      <div className="filters-wrapper">
        <button className={`filter-chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>All</button>
        <button className={`filter-chip ${filterType === 'group' ? 'active' : ''}`} onClick={() => setFilterType('group')}>Group</button>
        <button className={`filter-chip ${filterType === 'solo' ? 'active' : ''}`} onClick={() => setFilterType('solo')}>Solo</button>
        <button className={`filter-chip ${filterType === 'unit' ? 'active' : ''}`} onClick={() => setFilterType('unit')}>Unit</button>
      </div>
      <div className="filters-wrapper" style={{ marginTop: '8px' }}>
        <button className={`filter-chip ${genderFilter === 'all' ? 'active' : ''}`} onClick={() => setGenderFilter('all')}>성별 무관</button>
        <button className={`filter-chip ${genderFilter === 'male' ? 'active' : ''}`} onClick={() => setGenderFilter('male')}>남성 (남돌/솔로)</button>
        <button className={`filter-chip ${genderFilter === 'female' ? 'active' : ''}`} onClick={() => setGenderFilter('female')}>여성 (여돌/솔로)</button>
        <button className={`filter-chip ${genderFilter === 'mixed' ? 'active' : ''}`} onClick={() => setGenderFilter('mixed')}>혼성</button>
      </div>

      <div className="calendar-header">
        <button className="btn" onClick={prevMonth}>&larr; Prev</button>
        <h2>{monthNames[month]} {year}</h2>
        <button className="btn" onClick={nextMonth}>Next &rarr;</button>
      </div>
      
      <div className="calendar-weekdays">
        {weekDays.map(day => (
          <div key={day} className="calendar-weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarCells.map((cell, idx) => {
          const dayComebacks = comebacks.filter(c => {
            const dateMatch = c.dateObj.getFullYear() === cell.date.getFullYear() &&
                              c.dateObj.getMonth() === cell.date.getMonth() &&
                              c.dateObj.getDate() === cell.date.getDate();
            
            // Assume artistType exists on Comeback or default to matching all if undefined for now
            const typeMatch = filterType === 'all' ? true : (c.artistType?.toLowerCase() === filterType);
            const genderMatch = genderFilter === 'all' ? true : (c.artistGender?.toLowerCase() === genderFilter);
            
            // Match artist name or album title, plus support natural language gender queries
            const q = searchQuery.toLowerCase();
            const searchMatch = !q || 
                                (c.artistName && c.artistName.toLowerCase().includes(q)) || 
                                ((c as any).title && (c as any).title.toLowerCase().includes(q)) ||
                                ((q.includes('남돌') || q.includes('보이그룹') || q.includes('boy group')) && c.artistGender === 'male' && c.artistType === 'group') ||
                                ((q.includes('여돌') || q.includes('걸그룹') || q.includes('girl group')) && c.artistGender === 'female' && c.artistType === 'group') ||
                                ((q.includes('남성') || q.includes('male')) && c.artistGender === 'male') ||
                                ((q.includes('여성') || q.includes('female')) && c.artistGender === 'female') ||
                                ((q.includes('혼성') || q.includes('mixed')) && c.artistGender === 'mixed');
            
            return dateMatch && typeMatch && genderMatch && searchMatch;
          });

          return (
            <div 
              key={idx} 
              className={`calendar-cell ${!cell.isCurrentMonth ? 'different-month' : ''} ${isToday(cell.date) ? 'today' : ''}`}
            >
              <span className="calendar-date">{cell.date.getDate()}</span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {dayComebacks.map(c => {
                  return (
                    <button 
                      key={c.id} 
                      className={`event-pill ${getReleaseClass(c.releaseType)}`}
                      onClick={() => setSelectedComeback(c)}
                    >
                      {c.albumCoverUrl && (
                         <img src={c.albumCoverUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '4px', objectFit: 'cover' }} />
                      )}
                      <span className="event-artist">{c.isTba ? `[TBA] ${c.artistName}` : c.artistName}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <ComebackDialog comeback={selectedComeback} onClose={() => setSelectedComeback(null)} />
    </div>
  );
}
