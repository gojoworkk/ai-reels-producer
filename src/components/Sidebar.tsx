import { Suspense } from "react";
import { Clapperboard } from "lucide-react";
import { NavLinks, SidebarNav } from "./SidebarNav";

export function Sidebar() {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-sidebar max-md:w-14">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded bg-accent text-accent-fg">
          <Clapperboard size={14} strokeWidth={2.2} />
        </span>
        <span className="truncate text-sm font-semibold max-md:hidden">AI Reels Producer</span>
      </div>

      {/* Активный пункт зависит от URL, поэтому подсветка догружается после статической оболочки */}
      <Suspense fallback={<NavLinks pathname={null} />}>
        <SidebarNav />
      </Suspense>

      <div className="mt-auto px-3 pb-3 text-xs text-faint max-md:hidden">Найти → переписать → снять</div>
    </aside>
  );
}
