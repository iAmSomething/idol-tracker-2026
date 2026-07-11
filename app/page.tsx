"use client";

import { useState } from "react";
import CalendarGrid from "./_components/CalendarGrid";
import UpcomingTimeline from "./_components/UpcomingTimeline";
import ThemeToggle from "./_components/ThemeToggle";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <main className="app-container">
      <header className="dashboard-header" style={{ flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '280px' }}>
          <h1 className="dashboard-title">
            Idol Tracker <span className="accent">2026</span>
          </h1>
          <p className="text-secondary" style={{ fontSize: "1.2rem", maxWidth: "600px", marginTop: "4px" }}>
            Your ultimate calendar for K-Pop idol comebacks, album releases, and music videos.
          </p>
        </div>

        {/* Global Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, maxWidth: '400px', minWidth: '250px' }}>
          <input
            type="text"
            placeholder="아티스트 또는 앨범 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: 'var(--radius-soft)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--surface-color)',
              color: 'var(--text-primary)',
              fontSize: '0.95rem',
              outline: 'none',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
            className="search-bar-input"
          />
          <ThemeToggle />
        </div>
      </header>
      
      <section className="bento-layout">
        <CalendarGrid searchQuery={searchQuery} />
        <UpcomingTimeline searchQuery={searchQuery} />
      </section>
    </main>
  );
}
