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
const CsvExportButton = ({ data, headers, filename = 'data.csv', generalInfo, sx, children, variant = 'outlined' }) => {
  const handleExport = () => {
    if (!data || !data.length || !headers || !headers.length) return;

    const lines = [];

    if (Array.isArray(generalInfo) && generalInfo.length) {
      lines.push(escapeCsvField('General Information'));
      generalInfo.forEach(({ label, value }) => {
        lines.push(`${escapeCsvField(label)},${escapeCsvField(value)}`);
      });
      lines.push(''); // blank separator row between the info block and the table
    }

    const headerLine = headers
      .map(h => h === 'CarbonizingFurnace' ? 'CarburizingFurnace' : h)
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
