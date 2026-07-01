import React from 'react';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

// Shared color-coded KPI tile used by the scorecard stat panels.
export const KPI = { pct: '#3b82f6', ac: '#16a34a', nc: '#e0413a' };

export default function KpiTile({ label, value, color }) {
  return (
    <Box
      sx={{
        px: 1.5, py: 1.15,
        borderRadius: 1.5,
        bgcolor: (theme) => alpha(color, theme.palette.mode === 'light' ? 0.08 : 0.16),
        border: '1px solid',
        borderColor: (theme) => alpha(color, theme.palette.mode === 'light' ? 0.22 : 0.35),
        transition: 'transform .15s ease, box-shadow .15s ease',
        '&:hover': { transform: 'translateY(-1px)', boxShadow: `0 4px 12px ${alpha(color, 0.22)}` },
      }}
    >
      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.2 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1.05 }}>
        {value}
      </Typography>
    </Box>
  );
}
