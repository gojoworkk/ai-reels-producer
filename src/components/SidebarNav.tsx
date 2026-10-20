"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users } from "lucide-react";

const SECTIONS = [
  {
    title: "Главное",
    items: [{ href: "/", label: "Главное", icon: Home, match: (p: string) => p === "/" || p.startsWith("/reels") }],
  },
  {
    title: "Аналитика",
    items: [
      { href: "/competitors", label: "Конкуренты", icon: Users, match: (p: string) => p.startsWith("/competitors") },
    ],
  },
];

export function SidebarNav() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="mt-6 flex flex-col gap-6 px-3 max-md:px-1.5">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-2 px-3 text-[10px] font-medium tracking-[0.14em] text-faint uppercase max-md:hidden">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, icon: Icon, match }) => {
              const active = pathname !== null && match(pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  className={`flex h-9 items-center gap-3 rounded-md px-3 text-[13px] transition-colors max-md:justify-center max-md:px-0 ${
                    active ? "bg-card font-medium text-fg shadow-card ring-1 ring-line" : "text-muted hover:bg-hover hover:text-fg"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} className="shrink-0" />
                  <span className="truncate max-md:hidden">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
