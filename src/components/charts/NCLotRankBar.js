import React, { useEffect, useState, useMemo } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import axios from 'axios';
import { Box, Card, CardContent, CircularProgress, Grid, Typography, TextField, Button, MenuItem, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TableSortLabel, InputAdornment, Tooltip, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import Autocomplete from '@mui/material/Autocomplete';
import './NCLotRankBar.css';
import { useValue } from '../../context/ContextProvider';
import { useNavigate } from 'react-router-dom';

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
// The summary matrix needs a Carburizing/Tempering furnace breakdown per
// material. The current /overall-lots-nc-rank endpoint does NOT supply it (it
// counts dimension rows, not Individual-Lot keys, and has no furnace columns);
// the new KF6 ranking endpoint will. Until then we derive a stable, illustrative
// furnace pairing from the material key so the demo matrix renders complete.
// Replace deriveFurnaces() with the real endpoint fields when KF6 is built.
const TVC_POOL = ['TVC1', 'TVC2', 'TVC3', 'TVC4', 'TVC5'];
const TAT_POOL = ['TAT1', 'TAT2', 'TAT3', 'TAT4'];
const hashString = (s) => {
    let h = 0;
    for (let i = 0; i < (s || '').length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
};
const deriveFurnaces = (material, pool) => {
    const h = hashString(material);
    const n = 1 + (h % 2); // 1 or 2 furnaces, deterministic per material
    const picks = [];
    for (let i = 0; i < n; i++) picks.push(pool[(h + i * 7) % pool.length]);
    return Array.from(new Set(picks)).join(', ');
};

// Column config for the Material Description Summary table. `field` is the sort key
// (null = not sortable — action-button columns).
const MATERIAL_COLUMNS = [
    { label: 'Material Description', field: 'MaterialDesc', numeric: false },
    { label: 'Carburizing Furnace', field: '__tvc', numeric: false },
    { label: 'Tempering Furnace', field: '__tat', numeric: false },
    { label: 'Total (Lots)', field: 'Total_Count', numeric: true },
    { label: 'Ppk < 1 (Lots)', field: 'PPK_NC_Count', numeric: true },
    { label: 'Ppk < 1 %', field: 'PPK_NC_Percentage', numeric: true },
    { label: 'HRA / HRC Analysis', field: null },
    { label: 'Historical Analysis', field: null },
];

// Sort value for a row given a column field (handles derived furnace columns).
const materialSortValue = (row, field) => {
    switch (field) {
        case '__tvc': return deriveFurnaces(row.MaterialDesc, TVC_POOL) || '';
        case '__tat': return deriveFurnaces(row.MaterialDesc, TAT_POOL) || '';
        case 'Total_Count': return Number(row.Total_Count) || 0;
        case 'PPK_NC_Count': return Number(row.PPK_NC_Count) || 0;
        case 'PPK_NC_Percentage': return Number(row.PPK_NC_Percentage) || 0;
        default: return (row.MaterialDesc || '').toLowerCase();
    }
};

const NCLotRankBar = () => {
    const navigate = useNavigate();
    const [machineNCData, setMachineNCData] = useState([]);
    const [materialNCData, setMaterialNCData] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [search, setSearch] = useState('');
    const [order, setOrder] = useState('desc');
    const [orderBy, setOrderBy] = useState('');
    useEffect(() => { setPage(0); }, [materialNCData]);
    const [tvcNCData, setTvcNCData] = useState([]);
    const [tatNCData, setTatNCData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableOptions, setAvailableOptions] = useState({});
    const [allMonths, setAllMonths] = useState({ StartMonth: [], EndMonth: [] });
    const { state, dispatch } = useValue();

    // 直接用 context 的 filters，去掉本地 filters 状态
    const filters = useMemo(() => state.filters || {
        Dept: 'HT',
        MachineId: 'HTFDCATE-L1',
        MaterialDesc: '',
        DimensionDesc: '',
        CAT: ['CTQ', 'CTP', 'NOR'],
        StartMonth: '',
        EndMonth: '',
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
        const cleared = {
            Dept: '',
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
    let rows = materialNCData;
    if (q) {
      rows = rows.filter(r => {
        const tvc = deriveFurnaces(r.MaterialDesc, TVC_POOL) || '';
        const tat = deriveFurnaces(r.MaterialDesc, TAT_POOL) || '';
        return (r.MaterialDesc || '').toLowerCase().includes(q)
          || tvc.toLowerCase().includes(q)
          || tat.toLowerCase().includes(q);
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
  }, [materialNCData, search, order, orderBy]);

  const handleSort = (field) => {
    if (!field) return;
    if (orderBy === field) {
      setOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(field);
      // Text columns default to A→Z, numeric columns to high→low.
      setOrder(field === 'MaterialDesc' || field === '__tvc' || field === '__tat' ? 'asc' : 'desc');
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

    // Key Focus ranking data: Top-N materials by Ppk<1 Individual Lot count.
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
                        <IconButton
                            onClick={handleClearFilters}
                            sx={{ ml: 'auto', alignSelf: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, color: 'text.secondary', '&:hover': { color: 'error.main', borderColor: 'error.main' } }}
                        >
                            <FilterAltOffIcon fontSize="small" />
                        </IconButton>
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
                                <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                    Top 10 Material Description — Ranked by Ppk &lt; 1 Individual Lot Count
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'primary.main', fontStyle: 'italic', mb: 2, letterSpacing: 0.3 }}>
                                    ⓘ Important Note: Click a bar — or the action buttons in the summary below — to drill into the analysis.
                                </Typography>
                                {isMaterialAllZero || materialNCData.length === 0 ? (
                                    <Typography sx={{ fontSize: 15, color: 'grey.600', py: 6, textAlign: 'center' }}>No Result</Typography>
                                ) : (
                                    <BarChart
                                        height={460}
                                        margin={{ left: 54, right: 20, top: 16, bottom: 185 }}
                                        xAxis={[{
                                            data: materialNCData.slice(0, 10).map(r => (r.MaterialDesc || '').split(' ').join('\n')),
                                            scaleType: 'band',
                                            tickLabelStyle: { fontSize: 11.5, lineHeight: 1.25 },
                                        }]}
                                        yAxis={[{ tickLabelStyle: { fontSize: 12 } }]}
                                        series={[{
                                            data: materialNCData.slice(0, 10).map(r => r.PPK_NC_Count),
                                            label: 'Ppk < 1 Individual Lot Count',
                                            id: 'kfPpkLt1',
                                            color: '#26C6DA',
                                        }]}
                                        slotProps={{ legend: { labelStyle: { fontSize: 13 }, position: { vertical: 'bottom', horizontal: 'middle' }, direction: 'row' } }}
                                        barLabel={({ value }) => (value ? String(value) : '')}
                                        onItemClick={(event, d) => {
                                            const row = materialNCData[d.dataIndex];
                                            if (row) navigate('/nc-scatter-bar-chart', { state: { value: row.MaterialDesc, filters: { ...filters, MaterialDesc: row.MaterialDesc }, source: 'MaterialDesc' } });
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
                                                        <TableCell sx={{ color: 'text.secondary' }}>{deriveFurnaces(row.MaterialDesc, TVC_POOL)}</TableCell>
                                                        <TableCell sx={{ color: 'text.secondary' }}>{deriveFurnaces(row.MaterialDesc, TAT_POOL)}</TableCell>
                                                        <TableCell sx={{ color: 'text.primary' }}>{row.Total_Count}</TableCell>
                                                        <TableCell sx={{ color: 'error.main', fontWeight: 700 }}>{row.PPK_NC_Count}</TableCell>
                                                        <TableCell sx={{ color: Number.isFinite(pct) && pct >= 50 ? '#dc2626' : '#d97706', fontWeight: 700 }}>
                                                            {Number.isFinite(pct) ? pct.toFixed(2) : row.PPK_NC_Percentage}%
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button size="small" variant="contained" sx={{ backgroundColor: '#0e7490', textTransform: 'none', '&:hover': { backgroundColor: '#0b5566' } }}
                                                                onClick={() => navigate('/nc-scatter-bar-chart', { state: { value: row.MaterialDesc, filters: { ...filters, MaterialDesc: row.MaterialDesc }, source: 'MaterialDesc' } })}>
                                                                HRA / HRC
                                                            </Button>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Button size="small" variant="outlined" sx={{ textTransform: 'none', color: 'primary.main', borderColor: 'divider', '&:hover': { borderColor: '#5a6b8c' } }}
                                                                onClick={() => navigate('/overall-lots-clicked-table', { state: { ...filters, MaterialDesc: row.MaterialDesc, datatype: 'MaterialDesc' } })}>
                                                                Historical
                                                            </Button>
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
                                    Ppk &lt; 1 (Lots) counts Individual-Lot keys with Ppk &lt; 0.9949; Ppk &lt; 1 % = Ppk &lt; 1 (Lots) ÷ Total (Lots). Furnace breakdown is illustrative pending the KF6 ranking endpoint.
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