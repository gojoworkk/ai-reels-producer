"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "Главная", icon: Home, match: (p: string) => p === "/" || p.startsWith("/reels") },
  { href: "/competitors", label: "Конкуренты", icon: Users, match: (p: string) => p.startsWith("/competitors") },
];

export function SidebarNav() {
  return <NavLinks pathname={usePathname()} />;
}

export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="mt-2 flex flex-col gap-px px-1.5">
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex h-[30px] items-center gap-2.5 rounded-md px-2 text-sm transition-colors ${
              active ? "bg-active font-medium text-fg" : "text-muted hover:bg-hover"
            }`}
          >
            <Icon size={17} strokeWidth={1.8} className="shrink-0" />
            <span className="truncate max-md:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
