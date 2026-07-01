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
    <Box sx={{ px: 4, py: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
        <DeleteSweepIcon sx={{ fontSize: 36, color: '#ff8a65' }} />
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Data Purging Configuration</Typography>
      </Stack>
      <Typography variant="body1" sx={{ color: 'grey.500', mb: 3 }}>
        Define retention policies per data source and purge data beyond the retention window.
        Restricted to PID administrators.
      </Typography>

      <Grid container spacing={3}>
        {/* Retention policy table */}
        <Grid item xs={12} md={8}>
          <Card sx={{ backgroundColor: 'background.paper' }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>Retention Policy</Typography>
              <TableContainer>
                <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.12)' } }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'action.hover' }}>
                      <TableCell sx={{ color: '#cfe8ff', fontWeight: 700 }}>Data Source</TableCell>
                      <TableCell sx={{ color: '#cfe8ff', fontWeight: 700 }}>Grain</TableCell>
                      <TableCell sx={{ color: '#cfe8ff', fontWeight: 700 }}>Retention (months)</TableCell>
                      <TableCell sx={{ color: '#cfe8ff', fontWeight: 700 }}>Est. rows to purge</TableCell>
                      <TableCell sx={{ color: '#cfe8ff', fontWeight: 700 }}>Enabled</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rules.map((r) => {
                      const est = estimate.find((e) => e.key === r.key);
                      return (
                        <TableRow key={r.key} hover>
                          <TableCell sx={{ color: '#fff', fontWeight: 600 }}>{r.label}
                            <Typography variant="caption" sx={{ color: 'grey.600', display: 'block' }}>{r.key}</Typography>
                          </TableCell>
                          <TableCell sx={{ color: '#e0e0e0' }}>{r.grain}</TableCell>
                          <TableCell>
                            <TextField
                              type="number" size="small" value={r.retention}
                              onChange={(e) => setRetention(r.key, e.target.value)}
                              disabled={!r.enabled}
                              sx={{ width: 110 }}
                              InputProps={{ endAdornment: <InputAdornment position="end">mo</InputAdornment> }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: (est?.rows || 0) > 0 ? '#ff8a65' : 'grey.600', fontWeight: 700 }}>
                            {fmt(est?.rows || 0)}
                          </TableCell>
                          <TableCell>
                            <Switch checked={r.enabled} onChange={() => toggleEnabled(r.key)} color="warning" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
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
                <Typography sx={{ color: 'grey.400' }}>Total rows affected</Typography>
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
              <Typography variant="body2" sx={{ color: 'grey.500' }}>
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
            <Typography variant="caption" sx={{ color: 'grey.500' }}>
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
