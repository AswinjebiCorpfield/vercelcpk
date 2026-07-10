import React from 'react';
import { Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import dayjs from 'dayjs';

const escapeCsvField = (field) => {
  if (field === null || field === undefined) return '';
  // BRD data-export fix ("incorrect display for > or <"): normalize the math
  // comparison symbols to ASCII (≥ → >=, ≤ → <=) so they render correctly in
  // Excel regardless of the user's system locale / whether it honours the BOM.
  const str = String(field).replace(/≥/g, '>=').replace(/≤/g, '<=');
  if (str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  if (str.includes(',') || str.includes('\n')) {
    return `"${str}"`;
  }
  return str;
};

// BRD export enrichment (H2 / SS2): standardize export file naming as
// "MaterialDescription_Period". Sanitizes the material desc for a safe filename.
export const buildExportFilename = (materialDesc, period, fallback = 'PCM_Export') => {
  const clean = (s) => String(s || '').trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  const m = clean(materialDesc);
  const p = clean(period);
  const base = [m, p].filter(Boolean).join('_') || fallback;
  return `${base}.csv`;
};

// BRD export enrichment (H2 / SS2): emit a "General Information" block at the top
// of the exported file. `generalInfo` is an array of { label, value } pairs.
// `headerLabels` optionally maps a column key to a friendly display label for the
// CSV header row only — data is still looked up by the original key.
const CsvExportButton = ({ data, headers, filename = 'data.csv', generalInfo, statistics, headerLabels, sectionsAsColumns = false, sx, children, variant = 'outlined', startIcon = <DownloadIcon fontSize="small" /> }) => {
  const handleExport = () => {
    if (!data || !data.length || !headers || !headers.length) return;

    const lines = [];

    // Spreadsheets right-align any cell they parse as a number. To keep the Statistics
    // values left-aligned (matching the text General Information block) in BOTH Excel and
    // Google Sheets, emit numeric values as the ="20" formula-text form — both apps
    // evaluate it to the left-aligned text "20". (A leading-space trick only works in
    // Excel; Google Sheets trims it and re-parses as a number.) Non-numeric values
    // (e.g. "*", "-", dates) are already left-aligned and pass through unchanged.
    const leftAlignCell = (value) => {
      const s = String(value ?? '');
      if (s !== '' && !isNaN(s) && isFinite(Number(s))) {
        return `"=""${s.replace(/"/g, '""')}"""`;
      }
      return escapeCsvField(value);
    };

    // Force a value to left-aligned TEXT via the ="…" formula form — both Excel and
    // Google Sheets evaluate it to the literal string and never re-parse it. Needed for
    // date-looking strings ("Mar 03, 2026") that Excel would otherwise right-align and
    // collapse to a compact serial date ("Oct-25"). Opt-in per field via `asText: true`.
    const textCell = (value) => `"=""${String(value ?? '').replace(/"/g, '""')}"""`;

    // Emit a labelled block. Default: one "label,value" row per field (vertical).
    // With sectionsAsColumns: a header row of field labels + a single values row,
    // so each field lands in its own separate column. `leftAlign` forces numeric
    // values to be treated as left-aligned text in Excel; a field may also set
    // `asText: true` to force that single value to left-aligned text.
    const pushBlock = (heading, rows, leftAlign = false) => {
      if (!Array.isArray(rows) || !rows.length) return;
      lines.push(escapeCsvField(heading));
      const valueCell = leftAlign ? leftAlignCell : escapeCsvField;
      const cellFor = (r) => (r.asText ? textCell(r.value) : valueCell(r.value));
      if (sectionsAsColumns) {
        lines.push(rows.map(r => escapeCsvField(r.label)).join(','));
        lines.push(rows.map(cellFor).join(','));
      } else {
        rows.forEach((r) => {
          lines.push(`${escapeCsvField(r.label)},${cellFor(r)}`);
        });
      }
      lines.push(''); // blank separator row
    };

    pushBlock('General Information', generalInfo);
    pushBlock('Statistics', statistics, true);

    const headerLine = headers
      .map(h => (headerLabels && headerLabels[h] != null)
        ? headerLabels[h]
        : (h === 'CarbonizingFurnace' ? 'CarburizingFurnace' : h))
      .map(escapeCsvField)
      .join(',');
    lines.push(headerLine);

    data.forEach(row => {
      lines.push(headers.map(h => {
        if (h === 'MeasDate' && row[h]) {
          const parsed = dayjs(row[h]);
          return escapeCsvField(parsed.isValid() ? parsed.format('MMM DD, YYYY') : row[h]);
        }
        return escapeCsvField(row[h]);
      }).join(','));
    });

    // Prepend a UTF-8 BOM so Excel correctly renders symbols like ≥ ≤ ° and the
    // CTQ/CTP markers (fixes the garbled ">"/"<" symbol encoding on download).
    const csvContent = String.fromCharCode(0xFEFF) + lines.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <Button variant={variant} sx={sx} onClick={handleExport} startIcon={startIcon}>
      {children || 'Download Data'}
    </Button>
  );
};

export default CsvExportButton;
