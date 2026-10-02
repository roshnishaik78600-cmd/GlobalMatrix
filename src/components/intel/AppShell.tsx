import { Link, NavLink, useNavigate } from "react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";

const NAV = [
  { to: "/app", label: "Detection", index: "01", end: true },
  { to: "/app/risk", label: "Risk board", index: "02", end: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1600px] items-stretch justify-between px-5 lg:px-8">
          <div className="flex items-stretch">
            <Link
              to="/app"
              className="flex items-center gap-2.5 border-r border-rule pr-5 lg:pr-8"
            >
              <span className="block size-2.5 bg-signal" aria-hidden="true" />
              <span className="text-[13px] font-semibold tracking-[0.16em] uppercase">
                Meridian
              </span>
            </Link>
            <nav className="flex items-stretch">
              {NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2 border-r border-rule px-4 text-[11px] tracking-[0.14em] uppercase transition-colors lg:px-6",
                      isActive
                        ? "bg-ink text-paper"
                        : "text-muted-foreground hover:bg-secondary hover:text-ink",
                    )
                  }
                >
                  <span className="num opacity-50">{item.index}</span>
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center">
            <span className="hidden border-r border-rule px-5 text-[10px] tracking-[0.14em] text-muted-foreground uppercase lg:block">
              {CORPUS_LABEL}
            </span>
            <div className="flex items-center gap-3 px-4 lg:px-5">
              <span className="hidden max-w-[16ch] truncate text-[11px] text-muted-foreground sm:block">
                {user?.name ?? user?.email ?? "Researcher"}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                className="label border border-ink px-3 py-1.5 transition-colors hover:bg-ink hover:text-paper"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}

/** Numbered section header used at the top of every analyst screen. */
export function SectionHeader({
  index,
  title,
  lede,
  actions,
}: {
  index: string;
  title: string;
  lede: string;
  actions?: ReactNode;
}) {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-[1600px] px-5 pb-8 pt-10 lg:px-8 lg:pb-10 lg:pt-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="num text-[11px] font-semibold tracking-[0.2em] text-signal">
                {index}
              </span>
              <span className="h-px w-10 bg-rule" />
              <span className="label text-muted-foreground">
                Geopolitical propagation model
              </span>
            </div>
            <h1 className="display mt-5 text-[2.6rem] sm:text-[3.4rem] lg:text-[4.2rem]">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              {lede}
            </p>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      </div>
    </section>
  );
}

/** Filter control styled as a Swiss toggle rather than a rounded pill. */
export function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "label border px-3 py-2 transition-colors",
        active
          ? "border-ink bg-ink text-paper"
          : "border-rule text-muted-foreground hover:border-ink hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Framed content block with a caption bar. */
export function Panel({
  caption,
  aside,
  children,
  className,
}: {
  caption: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-rule bg-card", className)}>
      <div className="flex items-center justify-between gap-4 border-b border-rule px-4 py-2.5">
        <span className="label text-ink">{caption}</span>
        {aside ? <span className="label text-muted-foreground">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}