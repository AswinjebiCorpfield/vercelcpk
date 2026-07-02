import React, { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Grid, TextField, MenuItem, Switch,
  FormControlLabel, Button, Divider, Chip, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions, Alert, Stack, InputAdornment,
} from '@mui/material';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import HistoryIcon from '@mui/icons-material/History';
import ShieldIcon from '@mui/icons-material/Shield';
import StorageIcon from '@mui/icons-material/Storage';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DescriptionIcon from '@mui/icons-material/Description';
import BarChartIcon from '@mui/icons-material/BarChart';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// BRD General item 5 — "Configuration page for all data purging".
// The BRD leaves the detailed spec open, so this is a sensible, professional
// admin surface: retention policy per data source, a scope filter, a guarded
// purge action with confirmation, and an audit trail. The actual purge is
// wired to the backend in the API phase; here the action is simulated.

const DATA_SOURCES = [
  { key: 'QMM_InspectionData_import', label: 'Raw Subsample Measurements', grain: 'Raw rows', defRetention: 24 },
  { key: 'QMM_InspectionData_CPK', label: 'Individual Lot Capability', grain: 'Lot / dimension', defRetention: 36 },
  { key: 'QMM_Capability_CPK', label: 'Dimension Capability', grain: 'Dimension / subsample', defRetention: 36 },
  { key: 'QMM_ProcessCapability_import', label: 'Validation Metrics', grain: 'Dimension', defRetention: 12 },
];

const SOURCE_ICONS = {
  QMM_InspectionData_import: { Icon: DescriptionIcon, color: '#42a5f5' },
  QMM_InspectionData_CPK: { Icon: BarChartIcon, color: '#ab47bc' },
  QMM_Capability_CPK: { Icon: ViewInArIcon, color: '#26a69a' },
  QMM_ProcessCapability_import: { Icon: ShowChartIcon, color: '#ff8a65' },
};

const DEPTS = ['All', 'HT', 'CF', 'MS', 'STP'];

const fmt = (n) => new Intl.NumberFormat().format(n);

const DataPurgeConfig = () => {
  const [rules, setRules] = useState(
    DATA_SOURCES.map((s) => ({ ...s, retention: s.defRetention, enabled: true }))
  );
  const [dept, setDept] = useState('All');
  const [olderThan, setOlderThan] = useState('2024-06-01');
  const [dryRun, setDryRun] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState(null);

  // Illustrative impact estimate (deterministic, no backend) so the page reads
  // as a real tool. Replaced by a backend count query in the API phase.
  const estimate = useMemo(() => {
    const cutoff = new Date(olderThan).getTime();
    const monthsOld = Math.max(0, Math.round((Date.now() - cutoff) / (1000 * 60 * 60 * 24 * 30)));
    const deptFactor = dept === 'All' ? 1 : 0.4;
    return rules
      .filter((r) => r.enabled)
      .map((r) => {
        const base = (r.key.length * 1300) % 90000 + 5000;
        const rows = Math.round(base * Math.max(0, monthsOld - r.retention) / 12 * deptFactor);
        return { key: r.key, label: r.label, retention: r.retention, rows: Math.max(0, rows) };
      });
  }, [rules, dept, olderThan]);

  const totalRows = estimate.reduce((a, b) => a + b.rows, 0);
  const enabledCount = rules.filter((r) => r.enabled).length;
  const now = new Date();
  const lastUpdatedStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const lastUpdatedTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const setRetention = (key, val) =>
    setRules((rs) => rs.map((r) => (r.key === key ? { ...r, retention: Number(val) || 0 } : r)));
  const toggleEnabled = (key) =>
    setRules((rs) => rs.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)));

  const runPurge = () => {
    setConfirmOpen(false);
    setResult({
      when: new Date().toLocaleString(),
      dryRun,
      dept,
      olderThan,
      rows: totalRows,
      sources: estimate.filter((e) => e.rows > 0).length,
    });
  };

  return (
    <Box sx={{ px: 1.5, py: 3, width: '100%', boxSizing: 'border-box' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <DeleteSweepIcon sx={{ fontSize: 36, color: '#ff8a65' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Data Purging Configuration</Typography>
      </Stack>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3 }}>
        Define retention policies per data source and purge data beyond the retention window.
        Restricted to PID administrators.
      </Typography>

      <Grid container spacing={3}>
        {/* Retention policy table */}
        <Grid item xs={12} md={8}>
          {/* KPI summary cards */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { icon: <StorageIcon />, color: '#42a5f5', value: rules.length, label: 'Retention Sources', sub: 'Total configured' },
          { icon: <ShieldIcon />, color: '#66bb6a', value: enabledCount, label: 'Enabled Policies', sub: 'Active' },
          { icon: <DeleteSweepIcon />, color: '#ff8a65', value: fmt(totalRows), label: 'Rows to Purge (Est.)', sub: 'Across all sources', highlight: true },
          { icon: <CalendarMonthIcon />, color: '#ab47bc', value: lastUpdatedStr, label: 'Last Updated', sub: lastUpdatedTime, small: true },
        ].map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <Card sx={{ backgroundColor: 'background.paper', height: '100%' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${c.color}22`, color: c.color }}>
                  {c.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, display: 'block' }}>{c.label}</Typography>
                  <Typography sx={{ fontWeight: 'bold', fontSize: c.small ? 16 : 24, color: c.highlight ? '#ff8a65' : 'text.primary', lineHeight: 1.2 }}>{c.value}</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{c.sub}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
          </Grid>
          <Card sx={{ backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Retention Policy</Typography>
              <TableContainer>
                <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.12)' } }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Data Source</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Grain</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Retention (months)</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Est. rows to purge</TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.map((r) => {
                      const est = estimate.find((e) => e.key === r.key);
                      const rows = est?.rows || 0;
                      const src = SOURCE_ICONS[r.key] || { Icon: DescriptionIcon, color: '#42a5f5' };
                      const SrcIcon = src.Icon;
                      return (
                        <TableRow key={r.key} hover>
                          <TableCell sx={{ color: 'text.primary', fontWeight: 600 }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${src.color}22`, color: src.color }}>
                                <SrcIcon fontSize="small" />
                              </Box>
                              <Box>
                                {r.label}
                                <Typography variant="caption" sx={{ color: 'grey.600', display: 'block', fontWeight: 400 }}>{r.key}</Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ color: 'text.primary' }}>{r.grain}</TableCell>
                          <TableCell>
                            <TextField
                              type="number" size="small" value={r.retention}
                              onChange={(e) => setRetention(r.key, e.target.value)}
                              disabled={!r.enabled}
                              sx={{ width: 110 }}
                              InputProps={{ endAdornment: <InputAdornment position="end">mo</InputAdornment> }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: rows > 0 ? '#ff8a65' : '#66bb6a', fontWeight: 700 }}>
                            {fmt(rows)}
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Switch checked={r.enabled} onChange={() => toggleEnabled(r.key)} color="success" />
                              <Typography variant="body2" sx={{ color: r.enabled ? '#66bb6a' : 'text.secondary', fontWeight: 600 }}>
                                {r.enabled ? 'Enabled' : 'Disabled'}
                              </Typography>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              {/* Pagination footer (single page — 4 sources) */}
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Showing 1 to {rules.length} of {rules.length} entries
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Button size="small" variant="outlined" disabled sx={{ minWidth: 32, px: 0 }}><ChevronLeftIcon fontSize="small" /></Button>
                  <Button size="small" variant="outlined">1</Button>
                  <Button size="small" variant="outlined" disabled sx={{ minWidth: 32, px: 0 }}><ChevronRightIcon fontSize="small" /></Button>
                  <TextField select size="small" value={10} sx={{ ml: 1, width: 110 }}>
                    <MenuItem value={10}>10 / page</MenuItem>
                    <MenuItem value={25}>25 / page</MenuItem>
                    <MenuItem value={50}>50 / page</MenuItem>
                  </TextField>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Scope + action panel */}
        <Grid item xs={12} md={4}>
          <Card sx={{ backgroundColor: 'background.paper', mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Purge Scope</Typography>
              <TextField
                select fullWidth label="Department" value={dept}
                onChange={(e) => setDept(e.target.value)} sx={{ mb: 2 }}
              >
                {DEPTS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
              <TextField
                fullWidth type="date" label="Purge data older than" value={olderThan}
                onChange={(e) => setOlderThan(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ mb: 2 }}
              />
              <FormControlLabel
                control={<Switch checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} color="warning" />}
                label="Dry run (preview only)"
              />
              <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.12)' }} />
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography sx={{ color: 'text.secondary' }}>Total rows affected (est.)</Typography>
                <Chip label={fmt(totalRows)} color={totalRows > 0 ? 'warning' : 'default'} />
              </Stack>
              <Button
                fullWidth variant="contained" color="error" startIcon={<DeleteSweepIcon />}
                disabled={totalRows === 0}
                onClick={() => setConfirmOpen(true)}
              >
                {dryRun ? 'Preview Purge' : 'Run Purge'}
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ backgroundColor: 'background.paper' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <ShieldIcon sx={{ color: '#66bb6a' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Safeguards</Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                • Purges are irreversible and logged to the audit trail.<br />
                • Dry run is enabled by default.<br />
                • Validation metrics are retained for traceability.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Last-run audit */}
      {result && (
        <Card sx={{ backgroundColor: 'background.paper', mt: 3 }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <HistoryIcon sx={{ color: '#90caf9' }} />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Last Action</Typography>
            </Stack>
            <Alert severity={result.dryRun ? 'info' : 'success'} sx={{ mb: 1 }}>
              {result.dryRun
                ? `Dry run completed — ${fmt(result.rows)} rows across ${result.sources} source(s) would be purged.`
                : `Purge completed — ${fmt(result.rows)} rows across ${result.sources} source(s) removed.`}
            </Alert>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {result.when} · Dept: {result.dept} · Older than: {result.olderThan}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>{dryRun ? 'Preview purge?' : 'Confirm data purge'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {dryRun
              ? `This will estimate ${fmt(totalRows)} rows for purge across the enabled sources. No data is removed.`
              : `This will permanently delete approximately ${fmt(totalRows)} rows for Dept "${dept}" older than ${olderThan}. This action cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={runPurge} color={dryRun ? 'primary' : 'error'} variant="contained">
            {dryRun ? 'Run Preview' : 'Purge Now'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DataPurgeConfig;
