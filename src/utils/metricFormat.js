// Shared metric display helpers.
//
// BRD requirement (Scorecard / Subsample / Scatter): a capability metric whose
// result is < 1 must be highlighted in red. Non-numeric results (the BRD's "*"
// or "-" symbols, or null) are NOT highlighted — they keep the default colour.

export const METRIC_RED = '#F54D41';

// Returns METRIC_RED when `value` parses to a finite number < 1, otherwise the
// supplied fallback colour. Strings like "0.887" → red; "*", "-", "" → fallback.
export function metricColor(value, fallback = 'inherit') {
  const n = parseFloat(value);
  return Number.isFinite(n) && n < 1 ? METRIC_RED : fallback;
}

// BRD General item 1 — display rule for a capability metric:
//   • numeric            → the value (caller formats decimals)
//   • already "*" or "-" → passed through unchanged
//   • NULL/empty         → "*" when the lot had data (NO_OF_DATA > 1), else "-"
export function formatMetric(value, noOfData) {
  if (value === '*' || value === '-') return value;
  if (value !== null && value !== undefined && value !== '' && !isNaN(parseFloat(value))) return value;
  const n = parseInt(noOfData, 10);
  return Number.isFinite(n) && n > 1 ? '*' : '-';
}

// Convenience sx-fragment for a metric cell/typography.
export function metricSx(value, base = {}) {
  const n = parseFloat(value);
  const isLow = Number.isFinite(n) && n < 1;
  return { ...base, color: isLow ? METRIC_RED : base.color, fontWeight: isLow ? 700 : base.fontWeight };
}
