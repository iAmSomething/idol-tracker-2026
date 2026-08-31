import { Suspense } from "react";
import CalendarGrid from "./_components/CalendarGrid";
import SearchHeader from "./_components/SearchHeader";
import UpcomingTimeline from "./_components/UpcomingTimeline";

export default function Home() {
  return (
    <main className="app-container">
      <Suspense
        fallback={
          <header className="dashboard-header">
            <h1 className="dashboard-title">Loading...</h1>
          </header>
        }
      >
        <SearchHeader />
      </Suspense>

      <section className="bento-layout">
        <Suspense
          fallback={<div className="bento-card">Loading Calendar...</div>}
        >
          <CalendarGrid />
        </Suspense>
        <Suspense
          fallback={<div className="bento-card">Loading Timeline...</div>}
        >
          <UpcomingTimeline />
        </Suspense>
      </section>
    </main>
  );
}
