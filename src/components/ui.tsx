import type { ReactNode } from "react";

export const btnOutline =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-card px-3 text-[13px] font-medium shadow-card transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-40";
export const btnSolid =
  "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg shadow-card transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40";
export const btnSmall =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-line-strong bg-card px-2.5 text-xs font-medium shadow-card transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-40";
export const btnSmallSolid =
  "inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-semibold text-accent-fg shadow-card transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-40";
export const btnSmallGhost =
  "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-40";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-card shadow-card ${className}`}>{children}</section>;
}
