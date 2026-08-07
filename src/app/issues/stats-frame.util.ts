import {
  FormattedStatsDataPoint,
  StatsDataPointBase,
  StatsPeriod,
} from "./interfaces";

// Single source of truth for framing issue stats onto a time axis. Shared by
// the issue list (many issues) and the issue detail trend (one issue) so both
// bucket and align stats identically. Extracted from IssuesService to avoid a
// second, divergent implementation.

/**
 * Array of period timestamps counting back from the present, used as the chart
 * x-axis and as the basis for the empty-state frame.
 */
export function buildStatsChartDataFrame(
  period: StatsPeriod,
): StatsDataPointBase[] {
  const count = period === "14d" ? 14 : 24;
  return Array.from({ length: count }, (_, i) => {
    const baseTimeRef = new Date();
    const interval = i + 1 - count;
    let utcTimestamp: number;
    if (period === "14d") {
      utcTimestamp = Date.UTC(
        baseTimeRef.getUTCFullYear(),
        baseTimeRef.getUTCMonth(),
        baseTimeRef.getUTCDate() + interval,
        0,
        0,
        0,
      );
    } else {
      utcTimestamp = Date.UTC(
        baseTimeRef.getUTCFullYear(),
        baseTimeRef.getUTCMonth(),
        baseTimeRef.getUTCDate(),
        baseTimeRef.getUTCHours() + interval,
        0,
        0,
      );
    }
    return { name: utcTimestamp.toString(), timestamp: utcTimestamp };
  });
}

/** Map one issue's raw stats onto the period frame (0 where no data). */
export function formatIssueStats(
  stats:
    | { [key: string]: number[][] | null | undefined }
    | null
    | undefined,
  period: StatsPeriod,
  frame: StatsDataPointBase[],
): FormattedStatsDataPoint[] {
  const series = stats?.[period] ?? null;
  const mappedStats = new Map<number, number>(
    series?.map(([ts, val]) => [ts, val]),
  );
  return frame.map((datapoint) => ({
    ...datapoint,
    value: mappedStats.get(datapoint.timestamp / 1000) ?? 0,
  }));
}
