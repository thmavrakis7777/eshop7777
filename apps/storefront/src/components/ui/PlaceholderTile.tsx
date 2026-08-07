import type { Tone } from "@/lib/types";

const TONE_STYLES: Record<Tone, { bg: string; fg: string }> = {
  clay: { bg: "#e9d9cf", fg: "#8a5236" },
  sage: { bg: "#dfe4d8", fg: "#556b4d" },
  stone: { bg: "#e6e4de", fg: "#6b6862" },
  linen: { bg: "#efe9df", fg: "#8a7a5c" },
};

function initials(title: string): string {
  return title
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function PlaceholderTile({
  label,
  tone = "stone",
  className = "",
}: {
  label: string;
  tone?: Tone;
  className?: string;
}) {
  const { bg, fg } = TONE_STYLES[tone];
  return (
    <div
      className={`relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md ${className}`}
      style={{
        backgroundImage: `linear-gradient(135deg, ${bg} 25%, transparent 25%), linear-gradient(315deg, ${bg} 25%, transparent 25%)`,
        backgroundColor: "color-mix(in srgb, " + bg + " 55%, white)",
        backgroundSize: "16px 16px",
      }}
      aria-hidden="true"
    >
      <span
        className="font-display text-3xl tracking-tight opacity-70"
        style={{ color: fg }}
      >
        {initials(label)}
      </span>
    </div>
  );
}
