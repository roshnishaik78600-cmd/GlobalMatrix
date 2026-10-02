import type { ReactNode } from "react";
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
      <p className="text-[12.5px] font-medium">
        No verified data available.
      </p>
      <p className="max-w-md text-[11.5px] leading-relaxed text-muted-foreground">
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
            <span className="mt-1.5 block text-[12.5px] leading-snug">
              {item.a}
            </span>
          </>
        );
        return (
          <li key={item.q} className="bg-card">
            {item.href ? (
              <a
                href={item.href}
                className="block h-full p-3 transition-colors hover:bg-white/4"
              >
                {body}
              </a>
            ) : (
              <div className="h-full p-3">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}