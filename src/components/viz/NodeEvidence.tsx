import { Link } from "react-router";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { MiniSpark, usd } from "@/components/viz/VerifiedPanels";
import { SourceLine, SourceNote } from "@/components/viz/Provenance";
import {
  macroSeries,
  useMacroData,
  useTradeData,
} from "@/hooks/use-verified-data";

/**
 * "Show evidence" for one place.
 *
 * Only two things are asserted here, and both come from named public sources:
 * the growth figures the World Bank reports for this economy, and the
 * merchandise values it reports to UN Comtrade. Everything else on a country
 * page is model output and says so. If a source has no reading for this place
 * the row is simply absent — the panel never falls back to a number we made up.
 */
export function NodeEvidence({
  nodeId,
  className,
}: {
  nodeId: string;
  className?: string;
}) {
  const macro = useMacroData();
  const trade = useTradeData();

  const series: ReturnType<typeof macroSeries> = macro.data
    ? macroSeries(macro.data)
    : new Map();
  const growth = series.get(`${nodeId}:gdpGrowth`);
  const flow = trade.data?.find((f) => f.reporter === nodeId);

  if (!growth && !flow) {
    return (
      <NoVerifiedData
        title="Verified evidence"
        domain={`macro or merchandise-trade reporting for ${nodeId}`}
        className={className}
      />
    );
  }

  return (
    <div className={className}>
      <p className="label border-b border-rule px-3 py-2 text-muted-foreground">
        Show evidence
      </p>

      {growth ? (
        <div className="border-b border-rule px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px]">Real GDP growth</span>
            <span className="num text-[12px] font-semibold">
              {growth.latest.value.toFixed(1)}%
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <MiniSpark values={growth.history.map((h) => h.value)} width={96} />
            <span className="num text-[12px] text-muted-foreground">
              {growth.history.length} reported years · latest{" "}
              {growth.latest.period}
            </span>
          </div>
          <div className="mt-2">
            <SourceLine
              provenance={growth.latest.provenance}
              className="text-[12px]"
            />
          </div>
        </div>
      ) : null}

      {flow ? (
        <div className="px-3 py-2.5">
          <p className="label text-muted-foreground">Merchandise trade</p>
          <div className="mt-1.5 flex items-baseline justify-between gap-2">
            <span className="num text-[12px]">{usd(flow.exportsUsd)}</span>
            <span className="label text-muted-foreground">exports</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="num text-[12px]">{usd(flow.importsUsd)}</span>
            <span className="label text-muted-foreground">imports</span>
          </div>
          <div className="mt-2">
            <SourceLine provenance={flow.provenance} className="text-[12px]" />
          </div>
          <SourceNote note="Reported totals; the balance shown elsewhere is arithmetic on these two figures." />
        </div>
      ) : null}

      <div className="border-t border-rule px-3 py-2">
        <Link
          to="/app/data"
          className="label text-muted-foreground transition-colors hover:text-foreground"
        >
          How these figures are collected →
        </Link>
      </div>
    </div>
  );
}