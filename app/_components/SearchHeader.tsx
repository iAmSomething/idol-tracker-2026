"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./SearchHeader.module.css";
import ThemeToggle from "./ThemeToggle";

export default function SearchHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set("q", query);
      } else {
        params.delete("q");
      }

      // Update the URL without reloading the page
      router.replace(`${pathname}?${params.toString()}`);
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [query, router, pathname, searchParams]);

  return (
    <header className={styles.header}>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>
          Idol Tracker <span className={styles.accent}>2026</span>
        </h1>
        <p className={styles.subtitle}>
          Your ultimate calendar for K-Pop idol comebacks, album releases, and
          music videos.
        </p>
      </div>

      <div className={styles.controls}>
        <input
          type="text"
          placeholder="아티스트 또는 앨범 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.searchInput}
        />
        <ThemeToggle />
      </div>
    </header>
  );
}
