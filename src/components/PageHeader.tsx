import type { ReactNode } from "react";

export function PageHeader({
  crumb,
  title,
  description,
  children,
}: {
  crumb: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <header className="mb-7">
      <p className="text-[11px] text-faint">{crumb}</p>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] leading-tight font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1.5 max-w-xl text-[13px] text-muted">{description}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}

export function PageContainer({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={`mx-auto w-full px-4 pt-6 pb-24 md:px-8 ${wide ? "max-w-[1040px]" : "max-w-[760px]"}`}>
      {children}
    </div>
  );
}
