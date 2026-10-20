"use client";

import { useState } from "react";
import { Film } from "lucide-react";

// Обложки лежат на CDN Instagram и со временем протухают — показываем заглушку.
export function Thumb({ src, className = "" }: { src?: string; className?: string }) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <div className={`flex items-center justify-center bg-callout text-faint ${className}`}>
        <Film size={16} strokeWidth={1.6} />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setBroken(true)}
      className={`bg-callout object-cover ${className}`}
    />
  );
}
