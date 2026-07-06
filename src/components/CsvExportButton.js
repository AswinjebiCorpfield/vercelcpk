import React from 'react';
import { Button } from '@mui/material';
import dayjs from 'dayjs';

const escapeCsvField = (field) => {
  if (field === null || field === undefined) return '';
  const str = String(field);
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
const CsvExportButton = ({ data, headers, filename = 'data.csv', generalInfo, statistics, headerLabels, sx, children, variant = 'outlined' }) => {
  const handleExport = () => {
    if (!data || !data.length || !headers || !headers.length) return;

    const lines = [];

    // Emit a labelled block (heading + one "label,value" row per field, each on its own line).
    const pushBlock = (heading, rows) => {
      if (!Array.isArray(rows) || !rows.length) return;
      lines.push(escapeCsvField(heading));
      rows.forEach(({ label, value }) => {
        lines.push(`${escapeCsvField(label)},${escapeCsvField(value)}`);
      });
      lines.push(''); // blank separator row
    };

    pushBlock('General Information', generalInfo);
    pushBlock('Statistics', statistics);

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
    <Button variant={variant} sx={sx} onClick={handleExport}>
      {children || 'Download Data'}
    </Button>
  );
};

export default CsvExportButton;
