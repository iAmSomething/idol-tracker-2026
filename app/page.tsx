import CalendarGrid from "./_components/CalendarGrid";
import UpcomingTimeline from "./_components/UpcomingTimeline";
import ThemeToggle from "./_components/ThemeToggle";

export default function Home() {
  return (
    <main className="app-container">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">
            Idol Tracker <span className="accent">2026</span>
          </h1>
          <p className="text-secondary" style={{ fontSize: "1.2rem", maxWidth: "600px" }}>
            Your ultimate calendar for K-Pop idol comebacks, album releases, and music videos.
          </p>
        </div>
        <ThemeToggle />
      </header>
      
      <section className="bento-layout">
        <CalendarGrid />
        <UpcomingTimeline />
      </section>
    </main>
  );
}
