"use client";

import { getGreenNumberTier, GREEN_NUMBER_LABELS } from "@/lib/types";

interface GreenNumberBadgeProps {
  finishes: number;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export default function GreenNumberBadge({
  finishes,
  size = "sm",
  showLabel = false,
}: GreenNumberBadgeProps) {
  const tier = getGreenNumberTier(finishes);
  if (!tier) return null;

  const dotCount =
    tier === "quintuple" ? 5 :
    tier === "quad" ? 4 :
    tier === "triple" ? 3 :
    tier === "double" ? 2 : 1;

  const isSpecial = tier === "quintuple";
  const sizeClasses = size === "sm" ? "px-1.5 py-0.5 gap-0.5" : "px-2 py-1 gap-1";
  const dotSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClasses} ${textSize} ${
        isSpecial
          ? "bg-green-100 text-green-800 border border-yellow-400"
          : "bg-green-100 text-green-800 border border-green-300"
      }`}
      title={`${GREEN_NUMBER_LABELS[tier]} (${finishes} finishes)`}
    >
      <span className="inline-flex gap-0.5">
        {Array.from({ length: dotCount }).map((_, i) => (
          <span key={i} className={`${dotSize} rounded-full bg-green-600`} />
        ))}
      </span>
      {showLabel && (
        <span className="ml-0.5">{GREEN_NUMBER_LABELS[tier]}</span>
      )}
    </span>
  );
}
