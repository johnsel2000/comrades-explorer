"use client";

import { MEDAL_COLORS, MEDAL_NAMES } from "@/lib/types";

interface MedalBadgeProps {
  medal: string;
  size?: "sm" | "md";
}

export default function MedalBadge({ medal, size = "md" }: MedalBadgeProps) {
  // Handle medal codes (single char) or full names
  const fullName = MEDAL_NAMES[medal] || medal;
  const colors = MEDAL_COLORS[fullName];

  if (!colors || !fullName) return null;

  const sizeClasses =
    size === "sm"
      ? "px-1.5 py-0.5 text-[10px]"
      : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses}`}
    >
      {fullName}
    </span>
  );
}
