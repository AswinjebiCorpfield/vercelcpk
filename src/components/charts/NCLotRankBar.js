import React, { useEffect, useState, useMemo } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import axios from 'axios';
import { Box, Card, CardContent, CircularProgress, Grid, Typography, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel, InputAdornment, Tooltip } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import Autocomplete from '@mui/material/Autocomplete';
import './NCLotRankBar.css';
import { useValue } from '../../context/ContextProvider';
import { useNavigate } from 'react-router-dom';
import useDrilldownNavigate from '../../utils/useDrilldownNavigate';

function formatMonthYear(monthStr) {
    if (!monthStr) return '';
    const str = String(monthStr);
    if (/^\d{6}$/.test(str)) {
        const year = str.slice(0, 4);
        const month = str.slice(4, 6);
        const date = new Date(`${year}-${month}-01`);
        return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`;
    }
    if (str.length === 7 && str.includes('-')) {
        const [year, month] = str.split('-');
        const date = new Date(`${year}-${month}-01`);
        return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`;
    }
    return str;
}

const getRecent12MonthsStart = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${y}${m}`;
};

const getCurrentMonth = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${y}${m}`;
};

// 辅助函数：正确序列化 axios params（特别是数组）
const serializeParams = (params) => {
    const parts = [];
    for (const key in params) {
    const value = params[key];
    if (Array.isArray(value)) {
        // 对于数组，创建多个相同 key 的参数: &cat=CTQ&cat=NOR
        value.forEach(v => {
        if (v !== '' && v !== null && v !== undefined) {
            parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
        }
        });
    } else if (value !== '' && value !== null && value !== undefined) {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
    }
    return parts.join('&');
};

// --- Key Focus summary enrichment (BRD 3.1) --------------------------------
// Carburizing / Tempering furnace columns come straight from the API
// (/overall-lots-nc-rank now returns real CarburizingFurnace / TemperingFurnace
// aggregated from BatchMC2 / BatchMC4). No client-side fabrication.

// Column config for the Material Description Summary table. `field` is the sort key
// (null = not sortable — action-button columns).
const MATERIAL_COLUMNS = [
    { label: 'Material Description', field: 'MaterialDesc', numeric: false },
    { label: 'Carburizing Furnace', field: 'CarburizingFurnace', numeric: false },
    { label: 'Tempering Furnace', field: 'TemperingFurnace', numeric: false },
    { label: 'Total (Lots)', field: 'Total_Count', numeric: true },
    { label: 'Ppk < 1 (Lots)', field: 'PPK_NC_Count', numeric: true },
    { label: 'Ppk < 1 %', field: 'PPK_NC_Percentage', numeric: true },
    { label: 'Analysis', field: null },
];

// Sort value for a row given a column field.
const materialSortValue = (row, field) => {
    switch (field) {
        case 'CarburizingFurnace': return (row.CarburizingFurnace || '').toLowerCase();
        case 'TemperingFurnace': return (row.TemperingFurnace || '').toLowerCase();
        case 'Total_Count': return Number(row.Total_Count) || 0;
        case 'PPK_NC_Count': return Number(row.PPK_NC_Count) || 0;
        case 'PPK_NC_Percentage': return Number(row.PPK_NC_Percentage) || 0;
        default: return (row.MaterialDesc || '').toLowerCase();
    }
};

const NCLotRankBar = () => {
    const drill = useDrilldownNavigate();
    const navigate = useNavigate();
    const [machineNCData, setMachineNCData] = useState([]);
    const [materialNCData, setMaterialNCData] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('');
    // Key Focus chart: how many materials to plot. Numbers = Top-N by Ppk<1 count;
    // 'random' = 30 randomly sampled from the (already filter-applied) material list.
    const [topN, setTopN] = useState(10);
    // KF1: how many top-ranked materials to show (applies to both the chart and the
    // table). User-entered value clamped to 1–30; falls back to 10 (the default) when
    // the field is blank or invalid.
    const effectiveTopN = (() => {
        const n = Math.floor(Number(topN));
        return (!Number.isFinite(n) || n < 1) ? 10 : Math.min(30, n);
    })();
    useEffect(() => { setPage(0); }, [materialNCData]);
    const [tvcNCData, setTvcNCData] = useState([]);
    const [tatNCData, setTatNCData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableOptions, setAvailableOptions] = useState({});
    const [allMonths, setAllMonths] = useState({ StartMonth: [], EndMonth: [] });
    const { state, dispatch } = useValue();

    // 直接用 context 的 filters，去掉本地 filters 状态。
    // Key Focus is a Heat-Treatment module: furnaces (TVC/TAT) and HRA/HRC hardness
    // only exist for Dept='HT'. Pin Dept to 'HT' whenever it isn't explicitly set to
    // another dept — otherwise the ranking is dominated by Stamping parts that have no
    // furnace data, and drilling into a bar opens an empty HRA/HRC scatter.
    const filters = useMemo(() => {
        const base = state.filters || {
            Dept: 'HT',
            MachineId: '',
            MaterialDesc: '',
            DimensionDesc: '',
            CAT: ['CTQ', 'CTP', 'NOR'],
            StartMonth: '',
            EndMonth: '',
        };
        return { ...base, Dept: base.Dept || 'HT' };
    }, [state.filters]);

    // 处理筛选变化
    const handleFilterChange = (key, value) => {
        let updatedValue = value;
        // CAT多选处理
        if (key === 'CAT') {
            updatedValue = Array.isArray(value) ? value.filter(v => v && v.trim() !== '') : [];
        }
        const updated = { ...filters, [key]: updatedValue };
        dispatch({ type: 'UPDATE_FILTERS', payload: updated });
    };

    const handleClearFilters = () => {
        // Keep Dept pinned to 'HT' on clear — Key Focus is HT-scoped (see filters memo).
        const cleared = {
            Dept: 'HT',
            MachineId: '',
            MaterialDesc: '',
            DimensionDesc: '',
            CAT: [],
            StartMonth: '',
            EndMonth: '',
        };
        dispatch({ type: 'UPDATE_FILTERS', payload: cleared });
    };

    // 获取筛选选项
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const filterToSend = { ...filters };
                delete filterToSend.CAT;  // 不发送CAT到filter-options
                const response = await axios.post(
                    `${window.baseURL}/filter-options`,
                    { filter: filterToSend },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                setAvailableOptions(response.data);
                console.log('Available filter options:', response.data);
            } catch (error) {
                console.error('Error fetching filter options:', error);
            }
        };
        fetchFilterOptions();
    }, [filters]);

    // 首次加载时拉取所有月份
useEffect(() => {
    const fetchAllMonths = async () => {
        try {
            const resp = await axios.post(
                `${window.baseURL}/filter-options`,
                { filter: { Dept: 'HT', MachineId: 'HTFDCATE-L1' } },
                { headers: { 'Content-Type': 'application/json' } }
            );
            setAllMonths({
                StartMonth: resp.data.StartMonth || [],
                EndMonth: resp.data.EndMonth || [],
            });
        } catch (e) {
            setAllMonths({ StartMonth: [], EndMonth: [] });
        }
    };
    fetchAllMonths();
}, []);

  const allMonthsCombined = React.useMemo(() => {
    return Array.from(new Set([
      ...(allMonths.StartMonth || []),
      ...(allMonths.EndMonth || []),
    ])).sort((a, b) => a.localeCompare(b));
  }, [allMonths]);

  const startMonthOptions = React.useMemo(() => {
    if (!filters.EndMonth) return allMonthsCombined;
    return allMonthsCombined.filter(m => m <= filters.EndMonth);
  }, [allMonthsCombined, filters.EndMonth]);

  const endMonthOptions = React.useMemo(() => {
    if (!filters.StartMonth) return allMonthsCombined;
    return allMonthsCombined.filter(m => m >= filters.StartMonth);
  }, [allMonthsCombined, filters.StartMonth]);

  // Material summary: search filter + column sort applied before pagination.
  const processedMaterialData = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Table mirrors the chart's Top-N selection (materialNCData is rank-ordered).
    let rows = materialNCData.slice(0, effectiveTopN);
    if (q) {
      rows = rows.filter(r => {
        const tvc = (r.CarburizingFurnace || '').toLowerCase();
        const tat = (r.TemperingFurnace || '').toLowerCase();
        return (r.MaterialDesc || '').toLowerCase().includes(q)
          || tvc.includes(q)
          || tat.includes(q);
      });
    }
    if (!orderBy) return rows;
    const sorted = [...rows].sort((a, b) => {
      const va = materialSortValue(a, orderBy);
      const vb = materialSortValue(b, orderBy);
      if (va < vb) return order === 'asc' ? -1 : 1;
      if (va > vb) return order === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [materialNCData, effectiveTopN, search, order, orderBy]);

  const handleSort = (field) => {
    if (!field) return;
    if (orderBy === field) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(field);
      // Text columns default to A→Z, numeric columns to high→low.
      setOrder(field === 'MaterialDesc' || field === 'CarburizingFurnace' || field === 'TemperingFurnace' ? 'asc' : 'desc');
    }
    setPage(0);
  };

    // 获取图表数据
    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                if (filters.Dept === 'HT') {
                    // 只请求 TVC、TAT、MaterialDesc
                    const tvcResponse = await axios.get(`${window.baseURL}/unified-data-nc-rank`, {
                        params: {
                            datatype: 'TVC',
                            dept: filters.Dept,
                            machineId: filters.MachineId,
                            MaterialDesc: filters.MaterialDesc,
                            dimensionDesc: filters.DimensionDesc,
                            cat: filters.CAT,
                            startMonth: filters.StartMonth,
                            endMonth: filters.EndMonth,
                        }
                    });
                    setTvcNCData(tvcResponse.data);
                    console.log('TVC Data:', tvcResponse.data);

                    const tatResponse = await axios.get(`${window.baseURL}/unified-data-nc-rank`, {
                        params: {
                            datatype: 'TAT',
                            dept: filters.Dept,
                            machineId: filters.MachineId,
                            MaterialDesc: filters.MaterialDesc,
                            dimensionDesc: filters.DimensionDesc,
                            cat: filters.CAT,
                            startMonth: filters.StartMonth,
                            endMonth: filters.EndMonth,
                        }
                    });
                    setTatNCData(tatResponse.data);
                    console.log('TAT Data:', tatResponse.data);

                    const materialResponse = await axios.get(`${window.baseURL}/overall-lots-nc-rank`, {
                        params: {
                            datatype: 'MaterialDesc',
                            dept: filters.Dept,
                            machineId: filters.MachineId,
                            MaterialDesc: filters.MaterialDesc,
                            dimensionDesc: filters.DimensionDesc,
                            cat: filters.CAT,
                            startMonth: filters.StartMonth,
                            endMonth: filters.EndMonth,
                        },
                        paramsSerializer: serializeParams
                    });
                    setMaterialNCData(materialResponse.data);
                    console.log('MaterialDesc Data:', materialResponse.data);

                    setMachineNCData([]);
                } else {
                    // 原逻辑：MachineId 和 MaterialDesc
                    const response = await axios.get(`${window.baseURL}/overall-lots-nc-rank`, {
                        params: {
                            datatype: 'MachineId',
                            dept: filters.Dept,
                            machineId: filters.MachineId,
                            MaterialDesc: filters.MaterialDesc,
                            dimensionDesc: filters.DimensionDesc,
                            cat: filters.CAT,
                            startMonth: filters.StartMonth,
                            endMonth: filters.EndMonth,
                        },
                        paramsSerializer: serializeParams
                    });
                    setMachineNCData(response.data);
                    console.log('MachineId Data:', response.data);

                    const materialResponse = await axios.get(`${window.baseURL}/overall-lots-nc-rank`, {
                        params: {
                            datatype: 'MaterialDesc',
                            dept: filters.Dept,
                            machineId: filters.MachineId,
                            MaterialDesc: filters.MaterialDesc,
                            dimensionDesc: filters.DimensionDesc,
                            cat: filters.CAT,
                            startMonth: filters.StartMonth,
                            endMonth: filters.EndMonth,
                        },
                        paramsSerializer: serializeParams
                    });
                    setMaterialNCData(materialResponse.data);
                    console.log('MaterialDesc Data:', materialResponse.data);

                    setTvcNCData([]);
                    setTatNCData([]);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters]);

    // Key Focus ranking data: the user-selected Top-N materials by Ppk<1 Individual
    // Lot count (1–30, default 10). materialNCData is already filter-applied (API
    // query) and rank-ordered, so slicing honours the active filters.
    const chartMaterialData = useMemo(() => {
        return materialNCData.slice(0, effectiveTopN);
    }, [materialNCData, effectiveTopN]);

    const materialPpkLessThanOneCountList = materialNCData.map(item => item.PPK_NC_Count);
    const isMaterialAllZero = materialPpkLessThanOneCountList.length > 0 && materialPpkLessThanOneCountList.every(v => v === 0);

    return (
        <Grid container sx={{ px: 1.5, mt: 2, width: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
            <Grid item xs={12} sx={{ width: '100%' }}>
                <Box
                    className="filter-area"
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'flex-end',
                        gap: 1.25,
                        width: '100%',
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                    }}
                >
                    {Object.keys(availableOptions)
                        .filter(key => key !== 'StartMonth' && key !== 'EndMonth')
                        .map((key) => {
                            const isCAT = key === 'CAT';
                            const filterValue = filters[key];
                            
                            return (
                                <Autocomplete
                                    size="small"
                                    key={key}
                                    multiple={isCAT}
                                    options={
                                        isCAT
                                            ? (availableOptions[key] || []).filter(v => typeof v === 'string' && v.trim() !== '')
                                            : [
                                                '',
                                                ...((availableOptions[key] || []).filter(v => typeof v === 'string' && v.trim() !== ''))
                                              ]
                                    }
                                    value={isCAT ? (Array.isArray(filterValue) ? filterValue : []) : (filterValue ?? '')}
                                    onChange={(e, value) => handleFilterChange(key, value)}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label={key === 'MaterialDesc' ? 'MaterialDesc' : key}
                                            variant="outlined"
                                            sx={{ minWidth: 160, flex: '1 1 160px' }}
                                            placeholder={isCAT ? 'Select CAT' : 'All'}
                                            InputLabelProps={{ sx: { '&.MuiInputLabel-shrink': { bgcolor: 'background.paper', px: 0.5, borderRadius: 0.5 } } }}
                                        />
                                    )}
                                    getOptionLabel={(option) => option === '' ? '' : option}
                                    isOptionEqualToValue={(option, value) => option === value}
                                    disableClearable={isCAT}
                                    ListboxProps={{ style: { maxHeight: 300 } }}
                                    renderOption={(props, option) => (
                                        <li {...props}>{option === '' ? 'All' : option}</li>
                                    )}
                                />
                            );
                        })}
                <Autocomplete
                    size="small"
                    options={startMonthOptions}
                    value={filters.StartMonth || getRecent12MonthsStart()}
                    onChange={(e, value) => {
                        if (value === getRecent12MonthsStart() && !filters.StartMonth) {
                            handleFilterChange('StartMonth', '');
                        } else {
                            handleFilterChange('StartMonth', value);
                        }
                    }}
                    renderInput={params => (
                        <TextField
                            {...params}
                            label="Start Month"
                            variant="outlined"
                            sx={{ minWidth: 145, flex: '0 1 145px' }}
                            placeholder="All"
                            InputLabelProps={{ sx: { '&.MuiInputLabel-shrink': { bgcolor: 'background.paper', px: 0.5, borderRadius: 0.5 } } }}
                        />
                    )}
                    getOptionLabel={option => formatMonthYear(option)}
                    isOptionEqualToValue={(option, value) => option === value}
                    disableClearable={false}
                    ListboxProps={{ style: { maxHeight: 300 } }}
                    renderOption={(props, option) => {
                        const { key, ...rest } = props;
                        return (
                            <li key={option} {...rest}>
                                {formatMonthYear(option)}
                            </li>
                        );
                    }}
                    renderTags={() => null}
                />
                <Autocomplete
                    size="small"
                    options={endMonthOptions}
                    value={filters.EndMonth || getCurrentMonth()}
                    onChange={(e, value) => {
                        if (value === getCurrentMonth() && !filters.EndMonth) {
                            handleFilterChange('EndMonth', '');
                        } else {
                            handleFilterChange('EndMonth', value);
                        }
                    }}
                    renderInput={params => (
                        <TextField
                            {...params}
                            label="End Month"
                            variant="outlined"
                            sx={{ minWidth: 145, flex: '0 1 145px' }}
                            placeholder="All"
                            InputLabelProps={{ sx: { '&.MuiInputLabel-shrink': { bgcolor: 'background.paper', px: 0.5, borderRadius: 0.5 } } }}
                        />
                    )}
                    getOptionLabel={option => formatMonthYear(option)}
                    isOptionEqualToValue={(option, value) => option === value}
                    disableClearable={false}
                    ListboxProps={{ style: { maxHeight: 300 } }}
                    renderOption={(props, option) => {
                        const { key, ...rest } = props;
                        return (
                            <li key={option} {...rest}>
                                {formatMonthYear(option)}
                            </li>
                        );
                    }}
                    renderTags={() => null}
                />
                    <Tooltip title="Clear all filters">
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleClearFilters}
                            startIcon={<FilterAltOffIcon fontSize="small" />}
                            sx={{ ml: 'auto', alignSelf: 'center', fontSize: 12.5, fontWeight: 700, textTransform: 'none' }}
                        >
                            Clear
                        </Button>
                    </Tooltip>
                </Box>
            </Grid>
            {/* Content area */}
            <Grid item xs={12} sx={{
                minWidth: 0,
                width: '100%',
                mt: 2,
                overflow: 'auto',
            }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        {/* <Typography variant="h4" color="#00b0ff" sx={{ mb: 2 }}>
                            PPK LESS THAN 1 RANK
                        </Typography> */}
                        <Box sx={{ pt: 0, pb: 2, width: '100%' }}>
                            {/* KF1 — Clustered column: Top 10 Material Desc ranked by Ppk<1 Individual Lot Count */}
                            <Card sx={{ p: 3, mb: 3, backgroundColor: 'background.paper' }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                                        {`Top ${effectiveTopN} Material Description`} — Ranked by Ppk &lt; 1 Individual Lot Count
                                    </Typography>
                                    <TextField
                                        type="number"
                                        size="small"
                                        label="Show Top"
                                        value={topN}
                                        onChange={(e) => {
                                            const raw = e.target.value;
                                            if (raw === '') { setTopN(''); return; }
                                            const n = Math.floor(Number(raw));
                                            if (!Number.isFinite(n)) return;
                                            setTopN(Math.max(1, Math.min(30, n)));
                                        }}
                                        onBlur={() => { if (topN === '' || !Number.isFinite(Number(topN)) || Number(topN) < 1) setTopN(10); }}
                                        inputProps={{ min: 1, max: 30, step: 1 }}
                                        helperText="1 – 30 (default 10)"
                                        sx={{ minWidth: 130 }}
                                        InputLabelProps={{ sx: { '&.MuiInputLabel-shrink': { bgcolor: 'background.paper', px: 0.5, borderRadius: 0.5 } } }}
                                    />
                                </Box>
                                <Typography variant="body2" sx={{ color: 'primary.main', fontStyle: 'italic', mb: 2, letterSpacing: 0.3 }}>
                                    ⓘ Important Note: Click a bar — or the action buttons in the summary below — to drill into the analysis.
                                </Typography>
                                {isMaterialAllZero || materialNCData.length === 0 ? (
                                    <Typography sx={{ fontSize: 15, color: 'grey.600', py: 6, textAlign: 'center' }}>No Result</Typography>
                                ) : (
                                    <BarChart
                                        height={400}
                                        margin={{ left: 54, right: 20, top: 16, bottom: 120 }}
                                        xAxis={[{
                                            data: chartMaterialData.map(r => (r.MaterialDesc || '').split(' ').join('\n')),
                                            scaleType: 'band',
                                            tickLabelStyle: { fontSize: 11.5, lineHeight: 1.25 },
                                        }]}
                                        yAxis={[{ tickLabelStyle: { fontSize: 12 } }]}
                                        series={[{
                                            data: chartMaterialData.map(r => r.PPK_NC_Count),
                                            label: 'Ppk < 1 Individual Lot Count',
                                            id: 'kfPpkLt1',
                                            color: '#26C6DA',
                                        }]}
                                        slotProps={{ legend: { hidden: true } }}
                                        barLabel={({ value }) => (value ? String(value) : '')}
                                        onItemClick={(event, d) => {
                                            const row = chartMaterialData[d.dataIndex];
                                            if (row) drill('nc-scatter-bar-chart', { state: { value: row.MaterialDesc, filters: { ...filters, MaterialDesc: row.MaterialDesc }, source: 'MaterialDesc' } });
                                        }}
                                    />
                                )}
                            </Card>

                            {/* KF2 — Summary matrix with two drill-down actions */}
                            <Card sx={{ p: 3, backgroundColor: 'background.paper' }}>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                                        Material Description Summary
                                    </Typography>
                                    <TextField
                                        size="small"
                                        placeholder="Search material or furnace…"
                                        value={search}
                                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                                        sx={{ minWidth: 260 }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Box>
                                <TableContainer component={Box} sx={{ borderRadius: 1, overflow: 'auto' }}>
                                    <Table size="small" sx={{ '& td, & th': { borderColor: 'divider' } }}>
                                        <TableHead>
                                            <TableRow sx={{ backgroundColor: 'action.hover' }}>
                                                {MATERIAL_COLUMNS.map(col => (
                                                    <TableCell
                                                        key={col.label}
                                                        align={col.numeric ? 'left' : 'left'}
                                                        sortDirection={orderBy === col.field ? order : false}
                                                        sx={{ color: 'text.secondary', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}
                                                    >
                                                        {col.field ? (
                                                            <TableSortLabel
                                                                active={orderBy === col.field}
                                                                direction={orderBy === col.field ? order : 'asc'}
                                                                onClick={() => handleSort(col.field)}
                                                            >
                                                                {col.label}
                                                            </TableSortLabel>
                                                        ) : col.label}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {processedMaterialData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, i) => {
                                                const pct = Number(row.PPK_NC_Percentage);
                                                return (
                                                    <TableRow key={row.MaterialDesc || i} hover sx={{ '&:nth-of-type(odd)': { backgroundColor: 'action.hover' } }}>
                                                        <TableCell sx={{ color: 'text.primary', fontWeight: 600, whiteSpace: 'nowrap' }}>{row.MaterialDesc}</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary' }}>{row.CarburizingFurnace || '-'}</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary' }}>{row.TemperingFurnace || '-'}</TableCell>
                                                        <TableCell sx={{ color: 'text.primary' }}>{row.Total_Count}</TableCell>
                                                        <TableCell sx={{ color: 'error.main', fontWeight: 700 }}>{row.PPK_NC_Count}</TableCell>
                                                        <TableCell sx={{ color: Number.isFinite(pct) && pct >= 50 ? '#dc2626' : '#d97706', fontWeight: 700 }}>
                                                            {Number.isFinite(pct) ? pct.toFixed(2) : row.PPK_NC_Percentage}%
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5, alignItems: 'center', flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                                                <Button size="small" startIcon={<AssessmentIcon />} variant="contained" color="primary" sx={{ color: 'darkblue', textTransform: 'none', justifyContent: 'flex-start' }}
                                                                    onClick={() => drill('nc-scatter-bar-chart', { state: { value: row.MaterialDesc, filters: { ...filters, MaterialDesc: row.MaterialDesc }, source: 'MaterialDesc' } })}>
                                                                    HRA / HRC
                                                                </Button>
                                                                <Button size="small" startIcon={<HistoryIcon />} variant="contained" color="info" sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                                                                    onClick={() => {
                                                                        // Historical Dimension view for this material: set the material
                                                                        // filter in the shared context, then open the module page.
                                                                        dispatch({ type: 'UPDATE_FILTERS', payload: { ...filters, MaterialDesc: row.MaterialDesc } });
                                                                        navigate('/lots-historical-summary');
                                                                    }}>
                                                                    Historical
                                                                </Button>
                                                            </Box>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                            {processedMaterialData.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={MATERIAL_COLUMNS.length} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                                                        No matching materials
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                                <TablePagination
                                    component="div"
                                    count={processedMaterialData.length}
                                    page={page}
                                    onPageChange={(e, newPage) => setPage(newPage)}
                                    rowsPerPage={rowsPerPage}
                                    onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                                    rowsPerPageOptions={[10, 25, 50, 100]}
                                    sx={{ color: 'text.secondary' }}
                                />
                                <Typography variant="caption" sx={{ color: 'grey.500', display: 'block', mt: 1.5 }}>
                                    Ppk &lt; 1 (Lots) counts Individual-Lot keys with Ppk &lt; 0.9949; Ppk &lt; 1 % = Ppk &lt; 1 (Lots) ÷ Total (Lots). Carburizing / Tempering furnaces are the material's furnaces sourced from the database.
                                </Typography>
                            </Card>
                        </Box>
                    </>
                )}
            </Grid>
        </Grid>
    );
};

export default NCLotRankBar;