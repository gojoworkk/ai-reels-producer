"use client";

import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";

export function OriginalDialog({ url, videoUrl, onClose }: { url: string; videoUrl?: string; onClose: () => void }) {
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-xl border border-line bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-3 py-2">
          <span className="text-sm font-semibold">Оригинал</span>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-hover"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>
        {videoUrl && !videoFailed ? (
          <video
            src={videoUrl}
            controls
            autoPlay
            playsInline
            onError={() => setVideoFailed(true)}
            className="aspect-[9/16] max-h-[70vh] w-full bg-black"
          />
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted">
            Видео нельзя воспроизвести здесь — ссылка Instagram устарела. Откройте рилс в Instagram или обновите
            конкурента.
          </p>
        )}
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-1.5 border-t border-line px-3 py-2.5 text-sm hover:bg-hover"
        >
          Открыть в Instagram
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
