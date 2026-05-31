"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getCountries, formatTime, formatNumber } from "@/lib/data";
import type { CountryListEntry } from "@/lib/types";

type SortKey = "name" | "totalFinishers" | "uniqueAthletes" | "yearsActive" | "firstYear" | "avgTime";
type SortDir = "asc" | "desc";

export default function CountriesPage() {
  const [countries, setCountries] = useState<CountryListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("totalFinishers");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    getCountries()
      .then(setCountries)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = countries;
    if (q) {
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "totalFinishers":
          cmp = a.totalFinishers - b.totalFinishers;
          break;
        case "uniqueAthletes":
          cmp = a.uniqueAthletes - b.uniqueAthletes;
          break;
        case "yearsActive":
          cmp = a.yearsActive - b.yearsActive;
          break;
        case "firstYear":
          cmp = a.firstYear - b.firstYear;
          break;
        case "avgTime":
          cmp = a.avgTime.localeCompare(b.avgTime);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [countries, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) {
      return <svg className="w-3 h-3 text-gray-300 ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 15l5 5 5-5M7 9l5-5 5 5" /></svg>;
    }
    return sortDir === "asc"
      ? <svg className="w-3 h-3 text-comrades ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5" /></svg>
      : <svg className="w-3 h-3 text-comrades ml-1 inline" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-gray-400">Loading countries...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Countries</h1>
      <p className="text-gray-500 mb-6">
        {countries.length} countries have had finishers in the Comrades Marathon.
      </p>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-72 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-comrades/30 focus:border-comrades transition-all"
        />
        {search && (
          <span className="ml-3 text-xs text-gray-400">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th
                  className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("name")}
                >
                  Country <SortIcon column="name" />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none"
                  onClick={() => handleSort("totalFinishers")}
                >
                  Finishers <SortIcon column="totalFinishers" />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none hidden sm:table-cell"
                  onClick={() => handleSort("uniqueAthletes")}
                >
                  Athletes <SortIcon column="uniqueAthletes" />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none hidden md:table-cell"
                  onClick={() => handleSort("yearsActive")}
                >
                  Years <SortIcon column="yearsActive" />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none hidden lg:table-cell"
                  onClick={() => handleSort("firstYear")}
                >
                  First Year <SortIcon column="firstYear" />
                </th>
                <th
                  className="text-right px-4 py-3 font-medium text-gray-600 cursor-pointer hover:text-gray-900 select-none hidden lg:table-cell"
                  onClick={() => handleSort("avgTime")}
                >
                  Avg Time <SortIcon column="avgTime" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.slug} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/country?name=${c.slug}`}
                      className="font-medium text-gray-900 hover:text-comrades transition-colors"
                    >
                      <span className="mr-2">{c.flag}</span>
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-comrades">
                    {formatNumber(c.totalFinishers)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                    {formatNumber(c.uniqueAthletes)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 hidden md:table-cell">
                    {c.yearsActive}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 hidden lg:table-cell">
                    {c.firstYear}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-500 hidden lg:table-cell">
                    {formatTime(c.avgTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No countries match &quot;{search}&quot;
          </div>
        )}
      </div>
    </div>
  );
}
