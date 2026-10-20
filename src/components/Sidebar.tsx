import { Suspense } from "react";
import Link from "next/link";
import { NavLinks, SidebarNav } from "./SidebarNav";

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-sidebar max-md:w-14">
      <Link href="/" className="block px-6 pt-6 pb-2 max-md:px-3">
        <span className="block text-[17px] leading-none font-extrabold tracking-tight max-md:hidden">ИИ РИЛС</span>
        <span className="mt-1 block text-[10px] font-medium tracking-[0.14em] text-muted max-md:hidden">ПРОДЮСЕР</span>
        <span className="hidden text-[15px] font-extrabold md:hidden max-md:block">ИР</span>
      </Link>

      {/* Активный пункт зависит от URL, поэтому подсветка догружается после статической оболочки */}
      <Suspense fallback={<NavLinks pathname={null} />}>
        <SidebarNav />
      </Suspense>

      <div className="mt-auto px-6 pb-5 text-[11px] text-faint max-md:hidden">Найти → переписать → снять</div>
    </aside>
  );
}
