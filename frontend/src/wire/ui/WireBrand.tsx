import React from "react";

type WireBrandSize = "sm" | "md" | "lg";

function sizeToClasses(size: WireBrandSize) {
  switch (size) {
    case "sm":
      return { mark: "w-8 h-8 rounded-lg", text: "text-[15px]" };
    case "md":
      return { mark: "w-10 h-10 rounded-xl", text: "text-[16px]" };
    case "lg":
      return { mark: "w-16 h-16 rounded-2xl", text: "text-[22px]" };
  }
}

export function WireBrand({
  size = "sm",
  showWordmark = true,
  className = "",
  wordmarkClassName = "",
  alt = "WIRE",
}: {
  size?: WireBrandSize;
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
  alt?: string;
}) {
  const s = sizeToClasses(size);

  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <div
        className={`${s.mark} bg-black flex items-center justify-center ring-1 ring-black/10`}
        aria-hidden={showWordmark ? "true" : undefined}
      >
        <img
          src={`${import.meta.env.BASE_URL}brand/wire-mark.svg`}
          alt={showWordmark ? "" : alt}
          className="w-full h-full p-[18%]"
          draggable={false}
        />
      </div>
      {showWordmark && (
        <span
          aria-label="WIRE"
          className={[
            "text-gray-950",
            "font-semibold",
            "uppercase",
            "leading-none",
            s.text,
            // Premium-ish uppercase tracking; counter the last-letter spacing so it aligns nicely.
            "tracking-[0.34em]",
            "-mr-[0.34em]",
            wordmarkClassName,
          ].join(" ")}
        >
          WIRE
        </span>
      )}
    </div>
  );
}

