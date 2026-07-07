import React from 'react';
import {
  AppBar, Box, Container, Toolbar, IconButton, Typography, Button, Menu, MenuItem,
  TextField, Tooltip, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Menu as MenuIcon } from '@mui/icons-material';
import HomeIcon from '@mui/icons-material/Home';
import BarChartIcon from '@mui/icons-material/BarChart';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SummarizeIcon from '@mui/icons-material/Summarize';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import LaunchIcon from '@mui/icons-material/Launch';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import { Link, useLocation } from 'react-router-dom';
import { useColorMode } from '../context/ColorModeContext';

// Primary analytics modules, in a logical left-to-right order.
const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: <HomeIcon fontSize="small" />, end: true, locked: true }, // BRD S3: Overview module locked (non-clickable)
  { to: '/lot-cpk-bar', label: 'Individual Lot CPK', icon: <BarChartIcon fontSize="small" /> },
  { to: '/lots-cpk-ppk-bar', label: 'Dimension CPK PPK', icon: <AssessmentIcon fontSize="small" /> },
  { to: '/lots-historical-summary', label: 'Historical Dimension', icon: <SummarizeIcon fontSize="small" /> },
  { to: '/nc-lot-bar', label: 'Key Focus', icon: <SignalCellularAltIcon fontSize="small" /> },
  { to: '/data-purge-config', label: 'Data Purge', icon: <SettingsIcon fontSize="small" /> },
];

// Top-level modules the user can land on directly via the tab bar.
const SECTION_ROOTS = new Set([
  '/lot-cpk-bar', '/lots-cpk-ppk-bar', '/lots-historical-summary', '/nc-lot-bar', '/data-purge-config',
]);

// Cold-load fallback: which tab to light up when a drill-in / detail page is opened
// directly (URL paste / refresh) with no navigation history to infer the origin from.
// During real click-through the origin module is remembered instead (see NavBar),
// which is what keeps the *correct* tab active for pages shared by several modules
// (e.g. /lots-sample-distribution-table is reachable from four different modules).
const SECTION_BY_PATH = {
  '/': '/lot-cpk-bar',
  '/lot-cpk-bar': '/lot-cpk-bar',
  '/individual-lot-clicked-table': '/lot-cpk-bar',
  '/lots-cpk-ppk-bar': '/lots-cpk-ppk-bar',
  '/overall-lots-clicked-table': '/lots-cpk-ppk-bar',
  '/subsample-scatter': '/lots-cpk-ppk-bar',
  '/lots-sample-distribution-table': '/lots-cpk-ppk-bar',
  '/lots-historical-summary': '/lots-historical-summary',
  '/nc-lot-bar': '/nc-lot-bar',
  '/nc-scatter-bar-chart': '/nc-lot-bar',
  '/data-purge-config': '/data-purge-config',
};

const SPC_PORTAL_URL = 'https://spl-spc02.shimano.com.sg/SPC_Portal/login';

const NavBar = () => {
  const theme = useTheme();
  const { custom } = theme.palette;
  const { mode, toggle } = useColorMode();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const location = useLocation();

  // Resolve which module tab should be active — including drill-in pages opened
  // from a chart. URLs are hierarchical (see utils/useDrilldownNavigate), so the
  // FIRST path segment is the module the user drilled in from, e.g.
  // /lots-cpk-ppk-bar/overall-lots-clicked-table/... → Dimension CPK PPK.
  // SECTION_BY_PATH is only a fallback for legacy flat single-segment URLs.
  const path = location.pathname;
  const firstSeg = '/' + (path.split('/').filter(Boolean)[0] || '');
  const activeSection =
    path === '/' ? '/lot-cpk-bar'
      : SECTION_ROOTS.has(firstSeg) ? firstSeg
        : (SECTION_BY_PATH[path] || null);

  const tabSx = (isActive) => ({
    display: 'flex', alignItems: 'center', gap: 0.75,
    px: 1.75, py: 1.25,
    fontSize: 13, fontWeight: isActive ? 700 : 500,
    color: isActive ? 'primary.main' : 'text.secondary',
    borderBottom: '2px solid',
    borderColor: isActive ? 'primary.main' : 'transparent',
    cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none',
    transition: 'color .15s ease, border-color .15s ease, background-color .15s ease',
    '&:hover': { color: 'text.primary', backgroundColor: 'action.hover' },
    '& svg': { fontSize: 18 },
  });

  return (
    <Box sx={{ position: 'sticky', top: 0, zIndex: theme.zIndex.appBar }}>
      {/* Tier 1 — App header (brand + utilities) */}
      <AppBar position="static" elevation={0} sx={{ background: custom.nav, color: custom.navText }}>
        <Container disableGutters maxWidth={false}>
          <Toolbar disableGutters variant="dense" sx={{ pl: 1.5, pr: 1.5, minHeight: 50, gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                aria-label="Shimano"
                sx={{
                  height: 48, width: 116, flexShrink: 0,
                  backgroundImage: `url(${process.env.PUBLIC_URL || ''}/shimano-logo.png)`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)', my: 1 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '15px', letterSpacing: '-0.01em' }}>
                  PCM Dashboard
                </Typography>
                <Typography sx={{ fontSize: '10px', opacity: 0.6, letterSpacing: '0.04em' }}>
                  Process Capability Metrics
                </Typography>
              </Box>
              <TextField
                select variant="standard" defaultValue="SPL"
                onChange={(e) => { if (e.target.value !== 'SPL') alert('Under construction'); }}
                sx={{
                  ml: 1, minWidth: 64,
                  '& .MuiInput-input': { color: '#fff', fontSize: 13, fontWeight: 600 },
                  '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
                  '& .MuiInput-underline:before, & .MuiInput-underline:hover:not(.Mui-disabled):before, & .MuiInput-underline:after': {
                    borderBottomColor: 'rgba(255,255,255,0.4)',
                  },
                }}
              >
                <MenuItem value="SPL">SPL</MenuItem>
                <MenuItem value="SBM">SBM</MenuItem>
                <MenuItem value="SCM">SCM</MenuItem>
              </TextField>
            </Box>

            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Button
                component="a" href={SPC_PORTAL_URL}
                startIcon={<LaunchIcon fontSize="small" />}
                sx={{
                  color: 'rgba(255,255,255,0.8)', fontSize: '12.5px', fontWeight: 600,
                  display: { xs: 'none', sm: 'inline-flex' },
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' },
                }}
              >
                SPC Portal
              </Button>
              <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton onClick={toggle} size="small" sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { backgroundColor: 'rgba(255,255,255,0.12)' } }}>
                  {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <IconButton size="small" sx={{ display: { xs: 'inline-flex', md: 'none' }, color: '#fff' }} onClick={(e) => setAnchorEl(e.currentTarget)}>
                <MenuIcon />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Tier 2 — Module tab bar */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          px: 1.5,
          overflowX: 'auto',
          boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
        }}
      >
        {NAV_ITEMS.map((item) => (
          <React.Fragment key={item.to}>
            {item.label === 'Data Purge' && (
              <Divider orientation="vertical" flexItem sx={{ mx: 0.75, my: 1 }} />
            )}
            {item.locked ? (
              <Box
                aria-disabled="true"
                title="Locked"
                sx={{ ...tabSx(false), opacity: 0.4, cursor: 'not-allowed', '&:hover': { color: 'text.secondary', backgroundColor: 'transparent' } }}
              >
                {item.icon}
                {item.label}
              </Box>
            ) : (
              <Box component={Link} to={item.to} sx={tabSx(activeSection === item.to)}>
                {item.icon}
                {item.label}
              </Box>
            )}
          </React.Fragment>
        ))}
      </Box>

      {/* Mobile module menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {NAV_ITEMS.map((item) => (
          item.locked ? (
            <MenuItem key={item.to} disabled>
              {item.label}
            </MenuItem>
          ) : (
            <MenuItem key={item.to} onClick={() => setAnchorEl(null)} component={Link} to={item.to}>
              {item.label}
            </MenuItem>
          )
        ))}
        <MenuItem onClick={() => setAnchorEl(null)} component="a" href={SPC_PORTAL_URL}>SPC Portal</MenuItem>
      </Menu>
    </Box>
  );
};

export default NavBar;
