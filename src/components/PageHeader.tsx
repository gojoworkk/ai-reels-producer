import type { ReactNode } from "react";

export function PageHeader({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <div className="mb-3 text-fg">{icon}</div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-tight font-bold tracking-tight md:text-[40px]">{title}</h1>
          {description && <p className="mt-1.5 text-[15px] text-muted">{description}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}

export function PageContainer({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full px-4 pt-14 pb-24 md:px-12 md:pt-20 ${wide ? "max-w-[1200px]" : "max-w-[900px]"}`}>
      {children}
    </div>
  );
}
