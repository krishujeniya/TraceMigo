"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Example } from "../warmup/python/examples";
import {
  readProgress,
  getCompletedWarmups,
  MAX_ANONYMOUS_WARMUPS,
  type Progress,
} from "../warmup/python/progress";

export type CatalogCase = {
  id: string;
  slug: string;
  title: string;
  topic: string;
  level: "warmup" | "foundation" | "core";
  lines: number;
  files: number;
  summary: string;
  href: string;
};

const ADDITIONAL_CASES: CatalogCase[] = [
  {
    id: "token-bucket",
    slug: "token-bucket",
    title: "Token Bucket Rate Limiter",
    topic: "Concurrency & Clock State",
    level: "core",
    lines: 142,
    files: 3,
    summary: "State transitions, unsynchronized refill math, and clock boundaries in a rate limiter.",
    href: "/cases/python/token-bucket",
  },
  {
    id: "lru-cache",
    slug: "lru-cache",
    title: "Least Recently Used Cache",
    topic: "Doubly Linked List & Hash Map",
    level: "foundation",
    lines: 118,
    files: 2,
    summary: "O(1) lookup and eviction state management with boundary conditions on capacity.",
    href: "/cases/python/token-bucket",
  },
  {
    id: "retry-backoff",
    slug: "retry-backoff",
    title: "Exponential Backoff with Jitter",
    topic: "Timing & Randomness",
    level: "foundation",
    lines: 88,
    files: 2,
    summary: "Full jitter, truncated retry schedules, and network failure classification.",
    href: "/cases/python/token-bucket",
  },
  {
    id: "transaction-outbox",
    slug: "transaction-outbox",
    title: "Transactional Outbox Publisher",
    topic: "Distributed State & Idempotency",
    level: "core",
    lines: 176,
    files: 4,
    summary: "Relational staging table, at-least-once message relay, and deduplication keys.",
    href: "/cases/python/token-bucket",
  },
];

export function Library({ examples }: { readonly examples: Example[] }) {
  const [saved, setSaved] = useState<Record<string, Progress>>({});
  const [completedList, setCompletedList] = useState<string[]>([]);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");

  useEffect(() => {
    const progress: Record<string, Progress> = {};
    try {
      for (const example of examples) {
        const raw = sessionStorage.getItem(`tracemigo:warmup:${example.id}:v1`);
        if (!raw) continue;
        try {
          const value = readProgress(JSON.parse(raw), example);
          if (value?.prediction) progress[example.id] = value;
        } catch {
          /* Ignore malformed saved data for this example. */
        }
      }
      setCompletedList(getCompletedWarmups());
    } catch {
      setStorageAvailable(false);
    }
    setSaved(progress);
  }, [examples]);

  const warmupCases: CatalogCase[] = examples.map((ex) => ({
    id: ex.id,
    slug: ex.id,
    title: ex.title,
    topic: ex.topic,
    level: "warmup",
    lines: ex.code.length,
    files: 1,
    summary: ex.description,
    href: `/warmup/python/${ex.id}`,
  }));

  const allCases = [...warmupCases, ...ADDITIONAL_CASES];

  const filtered = allCases.filter((item) => {
    const matchesLevel = levelFilter === "all" || item.level === levelFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.topic.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q);
    return matchesLevel && matchesSearch;
  });

  const limitReached = completedList.length >= MAX_ANONYMOUS_WARMUPS;

  return (
    <>
      {limitReached && (
        <section className="catalog-limit-banner" aria-label="Warmup limit reached">
          <div className="limit-banner-content">
            <span className="tag">Deliberate Practice</span>
            <h2>All 3 anonymous warmups completed</h2>
            <p>
              You have completed all {MAX_ANONYMOUS_WARMUPS} free warmup micro-exercises.
              Take the next step in your practice:
            </p>
            <div className="limit-banner-actions">
              <Link href="/diagnostic" className="button">
                Begin Calibrated Diagnostic (25m) →
              </Link>
              <Link href="/register?transfer=true" className="button button-secondary">
                Save Progress to Account →
              </Link>
            </div>
          </div>
        </section>
      )}

      <p className="library-storage" role="status">
        {storageAvailable
          ? `Your place is saved separately for each warmup in this tab (${completedList.length}/${MAX_ANONYMOUS_WARMUPS} completed).`
          : "Tab storage is unavailable. You can still practice, but progress will not survive navigation."}
      </p>

      <div className="catalog-controls" role="search" aria-label="Filter catalog">
        <div className="search-box">
          <label htmlFor="catalog-search" className="visually-hidden">
            Search exercises
          </label>
          <input
            id="catalog-search"
            type="search"
            placeholder="Search by topic, keyword, or concept…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-buttons" role="group" aria-label="Filter by level">
          {["all", "warmup", "foundation", "core"].map((tier) => (
            <button
              key={tier}
              type="button"
              className={`filter-btn ${levelFilter === tier ? "active" : ""}`}
              onClick={() => setLevelFilter(tier)}
            >
              {tier === "all"
                ? "All Exercises"
                : tier === "warmup"
                ? "Warmups"
                : tier === "foundation"
                ? "Foundation"
                : "Core Cases"}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state-card" role="region" aria-label="No results">
          <p className="eyebrow">Zero Results</p>
          <h3>No exercises match your filter</h3>
          <p>
            We could not find any exercises matching &quot;{search}&quot; with level &quot;{levelFilter}&quot;.
          </p>
          <button
            type="button"
            className="button button-small"
            onClick={() => {
              setSearch("");
              setLevelFilter("all");
            }}
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="library-grid">
          {filtered.map((item) => {
            const isWarmup = item.level === "warmup";
            const progress = isWarmup ? saved[item.id] : undefined;
            const isCompleted = completedList.includes(item.id);

            return (
              <Link
                key={item.id}
                className="practice-card"
                href={item.href}
                data-exercise={item.id}
              >
                <div className="card-top">
                  <span className="tag">Python</span>
                  <span className="small-note">
                    {item.level.toUpperCase()} · {item.topic}
                  </span>
                </div>
                <h2>
                  {item.title} <span aria-hidden="true">↗</span>
                </h2>
                <p>{item.summary}</p>
                <p className="exercise-status">
                  {isCompleted
                    ? "Completed in this tab ✓"
                    : progress
                    ? `Your place: ${["Prediction", "Trace", "Explanation"][progress.stage]}`
                    : "Ready when you are"}
                </p>
                <div className="card-bottom">
                  <span>
                    {item.lines} lines · {item.files} {item.files === 1 ? "file" : "files"}
                  </span>
                  <strong>
                    {progress
                      ? "Continue warmup →"
                      : isWarmup
                      ? "Begin warmup →"
                      : "View case overview →"}
                  </strong>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
