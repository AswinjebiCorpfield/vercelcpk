import { createTheme } from '@mui/material/styles';

// ---------------------------------------------------------------------------
// PCM design system — enterprise-grade, supports light & dark mode.
// One factory builds both palettes so every surface/component stays cohesive.
// Custom tokens live on theme.palette.custom (surfaceAlt, nav, navText, …).
// ---------------------------------------------------------------------------
const CHART_FONT_SIZE = '13px';

const TOKENS = {
  dark: {
    bg: '#0b1018',
    paper: '#141b27',
    surfaceAlt: '#1d2636',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    text: '#e6edf5',
    textDim: '#93a1b5',
    nav: '#121a2e',
    navText: '#e6edf5',
    hover: 'rgba(255,255,255,0.06)',
    axis: '#8aa6cc',
  },
  light: {
    bg: '#f3f6fb',
    paper: '#ffffff',
    surfaceAlt: '#eef2f8',
    border: 'rgba(15,23,42,0.10)',
    borderStrong: 'rgba(15,23,42,0.18)',
    text: '#1c2531',
    textDim: '#5a6675',
    nav: '#16203a',          // deep indigo bar in both modes (enterprise standard)
    navText: '#e9eef6',
    hover: 'rgba(15,23,42,0.04)',
    axis: '#41557a',
  },
};

const ACCENT = {
  primary: '#3b82f6',
  primaryDark: '#2563eb',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#38bdf8',
};

export function createPcmTheme(mode = 'dark') {
  const t = TOKENS[mode] || TOKENS.dark;
  return createTheme({
    palette: {
      mode,
      primary: { main: mode === 'light' ? ACCENT.primaryDark : ACCENT.primary },
      success: { main: ACCENT.success },
      error: { main: ACCENT.danger },
      warning: { main: ACCENT.warning },
      info: { main: ACCENT.info },
      background: { default: t.bg, paper: t.paper },
      text: { primary: t.text, secondary: t.textDim },
      divider: t.border,
      custom: { ...t, accent: ACCENT },
    },
    shape: { borderRadius: 9 },
    typography: {
      fontFamily: '"Inter", "Segoe UI", Roboto, system-ui, -apple-system, sans-serif',
      subtitle1: { fontSize: CHART_FONT_SIZE },
      h2: { fontSize: '1.9rem', fontWeight: 700, letterSpacing: '-0.01em' },
      h3: { fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.01em' },
      h4: { fontSize: '1.05rem', fontWeight: 600 },
      h5: { fontSize: '0.95rem', fontWeight: 600 },
      h6: { fontSize: '0.9rem', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: t.bg, color: t.text, transition: 'background-color .25s ease, color .25s ease' },
          '::-webkit-scrollbar': { width: 10, height: 10 },
          '::-webkit-scrollbar-thumb': { background: t.borderStrong, borderRadius: 8 },
          '::-webkit-scrollbar-track': { background: 'transparent' },
          // Subtle entrance animation, applied via the .pcm-fade utility class.
          '@keyframes pcmFadeIn': {
            from: { opacity: 0, transform: 'translateY(6px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          '.pcm-fade': { animation: 'pcmFadeIn .35s ease both' },
          '.js-plotly-plot .xtick text, .js-plotly-plot .ytick text, .js-plotly-plot .legend text, .js-plotly-plot .gtitle, .js-plotly-plot .xtitle, .js-plotly-plot .ytitle': {
            fontSize: `${CHART_FONT_SIZE} !important`,
          },
        },
      },
      MuiBarLabel: { styleOverrides: { root: { fontSize: CHART_FONT_SIZE } } },
      MuiPieArcLabel: { styleOverrides: { root: { fontSize: CHART_FONT_SIZE } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: t.paper,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            boxShadow: mode === 'light' ? '0 1px 3px rgba(16,24,40,0.06)' : '0 1px 2px rgba(0,0,0,0.4)',
            transition: 'border-color .2s ease, box-shadow .2s ease',
            '&:hover': {
              borderColor: t.borderStrong,
              boxShadow: mode === 'light' ? '0 4px 14px rgba(16,24,40,0.10)' : '0 4px 16px rgba(0,0,0,0.5)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none', borderRadius: 8, fontWeight: 600,
            transition: 'background-color .15s ease, transform .12s ease, box-shadow .15s ease',
            '&:active': { transform: 'translateY(1px)' },
          },
          containedPrimary: { boxShadow: 'none' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 8, backgroundColor: t.surfaceAlt },
          notchedOutline: { borderColor: t.border },
        },
      },
      MuiTableContainer: { styleOverrides: { root: { backgroundColor: t.paper } } },
      MuiTableCell: {
        styleOverrides: {
          root: { padding: '7px 12px', borderColor: t.border, fontSize: '0.82rem' },
          head: {
            fontWeight: 700, fontSize: '0.8rem', backgroundColor: t.surfaceAlt,
            color: t.text, whiteSpace: 'nowrap', borderColor: t.borderStrong,
          },
        },
      },
      MuiTablePagination: { styleOverrides: { root: { fontSize: '0.8rem' } } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '12px',
            fontWeight: 500,
            padding: '6px 10px',
            borderRadius: 6,
            backgroundColor: mode === 'light' ? '#1c2531' : '#000000d9',
            border: `1px solid ${t.border}`,
          },
          arrow: { color: mode === 'light' ? '#1c2531' : '#000000d9' },
        },
      },
    },
  });
}

export const PCM_CHART_FONT_SIZE = CHART_FONT_SIZE;
