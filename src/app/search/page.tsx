"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSearchBucket } from "@/lib/data";
import type { SearchEntry } from "@/lib/types";
import MedalBadge from "@/components/MedalBadge";
import { MEDAL_NAMES } from "@/lib/types";

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchEntry[]>([]);
  const [allEntries, setAllEntries] = useState<SearchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedLetters, setLoadedLetters] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(50);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load search bucket when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setDisplayCount(50);
      return;
    }

    const q = query.trim().toLowerCase();

    // Figure out which letter(s) we need
    // Search the first letter of each word for potential surname matches
    const letters = new Set<string>();
    const words = q.split(/\s+/);
    for (const word of words) {
      if (word && word[0].match(/[a-z]/)) {
        letters.add(word[0]);
      }
    }
    if (letters.size === 0) letters.add("other");

    // Load any missing letter buckets
    const toLoad = [...letters].filter((l) => !loadedLetters.has(l));

    if (toLoad.length > 0) {
      setLoading(true);
      Promise.all(toLoad.map((l) => getSearchBucket(l)))
        .then((buckets) => {
          setAllEntries((prev) => {
            const existing = [...prev];
            for (const bucket of buckets) {
              existing.push(...bucket);
            }
            return existing;
          });
          setLoadedLetters((prev) => {
            const next = new Set(prev);
            for (const l of toLoad) next.add(l);
            return next;
          });
        })
        .finally(() => setLoading(false));
    }
  }, [query, loadedLetters]);

  // Filter results when allEntries or query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.trim().toLowerCase();
    const filtered = allEntries.filter((entry) =>
      entry[0].toLowerCase().includes(q)
    );
    // Sort by relevance: exact surname matches first, then by finishes
    filtered.sort((a, b) => {
      const aName = a[0].toLowerCase();
      const bName = b[0].toLowerCase();
      const aStarts = aName.startsWith(q) || aName.split(" ").some(w => w.startsWith(q));
      const bStarts = bName.startsWith(q) || bName.split(" ").some(w => w.startsWith(q));
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return b[2] - a[2]; // Sort by finishes descending
    });
    setResults(filtered);
    setDisplayCount(50);
  }, [query, allEntries]);

  // Update URL when query changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      const newUrl = params.toString() ? `/search?${params}` : "/search";
      router.replace(newUrl, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, router]);

  const handleLoadMore = useCallback(() => {
    setDisplayCount((c) => c + 50);
  }, []);

  const displayed = results.slice(0, displayCount);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Runners</h1>
      <p className="text-gray-500 mb-6">
        Search across 199K+ athletes from 100+ years of Comrades Marathon history.
      </p>

      {/* Search input */}
      <div className="relative mb-6">
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a name... e.g. 'Dave Rogers' or 'Holland'"
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-300 bg-white text-base focus:outline-none focus:ring-2 focus:ring-comrades/30 focus:border-comrades transition-all"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Status */}
      {loading && (
        <div className="text-center text-gray-400 py-8 animate-pulse">
          Loading search index...
        </div>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <p>No runners found for &quot;{query.trim()}&quot;</p>
          <p className="text-sm mt-1">Try a different spelling or a shorter query</p>
        </div>
      )}

      {!loading && !query.trim() && (
        <div className="text-center text-gray-400 py-12">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <p>Start typing to search for a runner</p>
        </div>
      )}

      {/* Results */}
      {displayed.length > 0 && (
        <>
          <div className="text-sm text-gray-500 mb-3">
            {results.length === 1
              ? "1 runner found"
              : `${results.length.toLocaleString()} runners found`}
          </div>
          <div className="space-y-2">
            {displayed.map((entry) => {
              const [name, athleteId, finishes, firstYear, lastYear, medalCode] = entry;
              const medalName = MEDAL_NAMES[medalCode] || "";
              return (
                <Link
                  key={athleteId}
                  href={`/runner?id=${athleteId}`}
                  className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3 hover:shadow-md hover:border-comrades/30 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 group-hover:text-comrades transition-colors truncate">
                        {name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {firstYear}–{lastYear}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    {medalName && <MedalBadge medal={medalName} size="sm" />}
                    <div className="text-right">
                      <div className="text-lg font-bold text-comrades">{finishes}</div>
                      <div className="text-xs text-gray-400">
                        {finishes === 1 ? "finish" : "finishes"}
                      </div>
                    </div>
                    <svg
                      className="w-4 h-4 text-gray-300 group-hover:text-comrades transition-colors"
                      fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>

          {displayCount < results.length && (
            <div className="text-center mt-6">
              <button
                onClick={handleLoadMore}
                className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Show more ({results.length - displayCount} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse text-gray-400">Loading...</div>
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
