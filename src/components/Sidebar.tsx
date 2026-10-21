"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Главное" },
  { href: "/competitors", label: "Конкуренты" },
  { href: "/profile", label: "Мой профиль" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="logo">Reels Finder</div>
      <nav className="nav">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={path === i.href ? "active" : ""}>
            {i.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
