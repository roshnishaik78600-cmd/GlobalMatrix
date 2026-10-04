import type { ReactNode } from "react";
import { Link } from "react-router";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The standard honest empty state for a domain GlobalMatrix cannot populate.
 *
 * Shown rather than hidden: a reader must be able to tell the difference
 * between "nothing is happening" and "we are not measuring this yet".
 */
export function NoVerifiedData({
  title,
  domain,
  className,
  action,
}: {
  title: string;
  domain: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Database className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="label text-foreground/85">{title}</span>
      </div>
      <p className="text-[13px] font-medium">
        No verified data available.
      </p>
      <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground">
        GlobalMatrix has no {domain} data source connected. Rather than show
        estimates or placeholders, this panel stays empty until a real feed is
        connected.
      </p>
      {action}
    </div>
  );
}

/** The five questions, answered in order, as a compact strip. */
export function QuestionStrip({
  answers,
  className,
}: {
  answers: { q: string; a: string; href?: string }[];
  className?: string;
}) {
  return (
    <ol
      className={cn(
        "grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-5",
        className,
      )}
    >
      {answers.map((item, i) => {
        const body = (
          <>
            <span className="label text-muted-foreground">
              {String(i + 1).padStart(2, "0")} · {item.q}
            </span>
            <span className="mt-1.5 block text-[13px] leading-snug">
              {item.a}
            </span>
          </>
        );
        return (
          <li key={item.q} className="bg-card">
            {item.href ? (
              // A router Link, not a raw anchor: under BrowserRouter a plain
              // <a href="/app/..."> triggers a full document reload, which threw
              // away every open query subscription and the reader's place.
              <Link
                to={item.href}
                className="block h-full p-3 transition-colors hover:bg-[var(--exec-surface)]"
              >
                {body}
              </Link>
            ) : (
              <div className="h-full p-3">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}