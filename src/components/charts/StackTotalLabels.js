import React from 'react';
import { useXScale, useYScale } from '@mui/x-charts/hooks';

// BRD S1: "Include total count label for stacked column chart."
// MUI X Charts has no native stack-total label, so this is a small custom SVG
// layer rendered INSIDE a <BarChart> (where the axis scales are always present).
// It draws the total (AC + NC) just above each stacked column. Guarded so that
// if a scale/position is unavailable it simply renders nothing — it can never
// break the chart.
//
// In COUNT mode the bar height IS the total, so `totals` doubles as both the
// y-anchor and the printed number. In PERCENT mode the bar height is the
// percentage (~100) but we still want to print the underlying count total, so:
//   - `positions` gives the y-anchor (the percent stack top, e.g. acPct+ncPct)
//   - `labels`    gives the text to print (the formatted count total)
// Both are optional and fall back to `totals` for the count-mode behaviour.
//
// `angle` rotates each label (degrees). When there are many bars the horizontal
// totals overlap, so the charts pass angle=-90 to stand them up vertically
// (reading bottom-to-top), mirroring the angled x-axis tick labels.
export default function StackTotalLabels({ categories = [], totals = [], positions, labels, color = '#ffffff', angle = 0 }) {
  const xScale = useXScale();
  const yScale = useYScale();
  if (!xScale || !yScale || typeof xScale.bandwidth !== 'function') return null;
  const bandwidth = xScale.bandwidth();
  const rotated = angle !== 0;
  return (
    <g className="stack-total-labels" style={{ pointerEvents: 'none' }}>
      {categories.map((cat, i) => {
        const total = totals[i];
        if (!total) return null;
        const anchor = positions ? positions[i] : total;
        if (anchor == null) return null;
        const x = xScale(cat);
        const y = yScale(anchor);
        if (x == null || y == null || Number.isNaN(x) || Number.isNaN(y)) return null;
        const text = labels ? labels[i] : new Intl.NumberFormat().format(total);
        const px = x + bandwidth / 2;
        const py = y - 8;
        return (
          <text
            key={`${cat}-${i}`}
            x={px}
            y={py}
            textAnchor={rotated ? 'start' : 'middle'}
            dominantBaseline={rotated ? 'central' : 'auto'}
            transform={rotated ? `rotate(${angle}, ${px}, ${py})` : undefined}
            fontSize={rotated ? 12 : 14}
            fontWeight={700}
            fill={color}
          >
            {text}
          </text>
        );
      })}
    </g>
  );
}
