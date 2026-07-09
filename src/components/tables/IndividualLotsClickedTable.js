import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, TablePagination } from '@mui/material';
import { formatMetric } from '../../utils/metricFormat';
import { compareLotNoLast7 } from '../../utils/lotNo';
import axios from 'axios';
import AssessmentIcon from '@mui/icons-material/Assessment';
import Button from '@mui/material/Button';
import useDrilldownNavigate from '../../utils/useDrilldownNavigate';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import FilterListIcon from '@mui/icons-material/FilterList';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import Popover from '@mui/material/Popover';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import InputAdornment from '@mui/material/InputAdornment';
import CsvExportButton from '../CsvExportButton';
import { PieChart, pieArcLabelClasses } from '@mui/x-charts/PieChart';
import Collapse from '@mui/material/Collapse';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function formatMonthYear(monthStr) {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    if (!year || !month) return monthStr;
    const date = new Date(`${year}-${month}-01`);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`; // 'Feb 2024'
}

// Day-month-year for daily (line-chart) drill-in filenames, e.g. '15 Mar 2026'.
function formatDayMonthYear(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    return `${date.getDate()} ${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
}

function formatMonthDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    const month = date.toLocaleString('en-US', { month: 'long' }); // 'June'
    const day = date.getDate(); // 4
    const year = date.getFullYear(); // 2025
    return `${month} ${day}, ${year}`; // 'June 4, 2025'
}

function formatMeasDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;
    // "MMM dd, yyyy" 例如 "Sep 05, 2023"
    return date.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

const columns = [
    { id: 'LotNo', label: 'LotNo', minWidth: 68 }, // 80*0.85=68
    { id: 'MeasDate', label: 'MeasDate', getValue: (row) => formatMeasDate(row.MeasDate) },
    { id: 'Dept', label: 'Dept', minWidth: 39 }, // 56*0.7=39
    { id: 'MachineId', label: 'MachineId' },
    { id: 'MaterialDesc', label: 'MaterialDesc' },
    { id: 'DimensionDesc', label: 'DimensionDesc' },
    { id: 'CAT', label: 'CAT' },
    { id: 'CPK', label: 'CPK', isNumeric: true },
    { id: 'CP', label: 'CP', isNumeric: true },
    { id: 'NO_OF_DATA', label: 'NO OF DATA', isNumeric: true, minWidth: 39 }, // 56*0.7=39
    // BRD M3c: furnace columns standardized to sit behind the "No of Data" column.
    { id: 'CarbonizingFurnace', label: 'CarburizingFurnace', minWidth: 49 }, // 70*0.7=49
    { id: 'TemperingFurnace', label: 'TemperingFurnace', minWidth: 59 }, // 84*0.7=59
    { id: 'FurtherAnalysis', label: 'Analysis' }
];

const MAX_NC = 0.9949;

const PIE_COLORS = [
    '#4FC3F7', '#81C784', '#FFD54F', '#FF8A65', '#BA68C8', '#F06292', '#FFF176', '#AED581', '#9575CD', '#64B5F6'
];
const PIE_COLORS2 = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28CFF', '#FF6699', '#FFB347', '#B6FFB3', '#FF6666', '#66B3FF'
];
const PIE_COLORS3 = [
    '#FFB6C1', '#B3B6FF', '#FFD700', '#B3FFD9', '#FF8C00', '#8CFF8C', '#8C8CFF', '#FF8CB3', '#B3FF8C', '#8CB3FF'
];

function getPieData(data, key, colorArr, options = {}) {
    const stats = {};
    data.forEach(row => {
        let val = row[key] || 'Unknown';
        // MaterialDesc特殊处理：只取前两个字母分组
        if (options.groupMaterial && key === 'MaterialDesc') {
            val = typeof val === 'string' ? val.slice(0, 2).toUpperCase() : 'Un';
        }
        stats[val] = (stats[val] || 0) + 1;
    });
    // 按label字母排序
    return Object.entries(stats)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, value], idx) => ({
            label,
            value,
            color: colorArr[idx % colorArr.length],
            rawLabel: label
        }));
}

const IndividualLotClickedTable = () => {
    const location = useLocation();
    const { state } = location || {};
    const [queryData, setQueryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(500);
    const [orderBy, setOrderBy] = useState('LotNo');
    const [order, setOrder] = useState('asc');
    const [filterValues, setFilterValues] = useState({});
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [filterColumn, setFilterColumn] = useState(null);
    const [rangeValues, setRangeValues] = useState({});
    const [leftOpen, setLeftOpen] = useState(true);
    const [pieFilter, setPieFilter] = useState({
        CarbonizingFurnace: null,
        TemperingFurnace: null,
        MaterialDesc: null
    });
    const drill = useDrilldownNavigate();
    const { date, periodType, filters, seriesId } = state || {};

    useEffect(() => {
        if (date) {
            const fetchData = async () => {
                setLoading(true);
                try {
                    // 移除 StartMonth/EndMonth，避免遗传冲突
                    let filter = { ...(filters || {}) };
                    delete filter.StartMonth;
                    delete filter.EndMonth;
                    if (periodType === 'month') {
                        filter.Period = date.replace('-', '');
                    } else if (periodType === 'date') {
                        filter.MeasDate = date;
                    }
                    let ResultType = '';
                    seriesId.slice(0, 2) === 'ac'?(
                        ResultType = 'AC'
                    ):(
                        ResultType = 'NC');
                    const response = await axios.post(`${window.baseURL}/unified-data`, {
                        dataType: 'IndividualLot',
                        filter,
                        ResultType
                    });
                    // log前五行
                    if (Array.isArray(response.data)) {
                        console.log('First 5 rows:', response.data.slice(0, 5));
                    }
                    setQueryData(response.data);
                } catch (error) {
                    console.error('Error fetching data:', error);
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        }
    }, [date, periodType, filters, seriesId]);

    // 页面挂载时恢复排序等状态
    useEffect(() => {
        const saved = localStorage.getItem('individualLotsClickedTableState');
        if (saved) {
            try {
                const stateObj = JSON.parse(saved);
                setOrderBy(stateObj.orderBy ?? 'LotNo');
                setOrder(stateObj.order ?? 'asc');
                setPage(stateObj.page ?? 0);
                setRowsPerPage(stateObj.rowsPerPage ?? 500);
            } catch {}
        }
    }, []);

    // 状态变化时保存到 localStorage
    useEffect(() => {
        const stateToSave = {
            orderBy,
            order,
            page,
            rowsPerPage
        };
        localStorage.setItem('individualLotsClickedTableState', JSON.stringify(stateToSave));
    }, [orderBy, order, page, rowsPerPage]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0); // Reset to first page
    };

    const handleRequestSort = (columnId) => {
        const isAsc = orderBy === columnId && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(columnId);
    };

    // 打开对应列的filter popover
    const handleFilterIconClick = (event, columnId) => {
        setFilterAnchorEl(event.currentTarget);
        setFilterColumn(columnId);
        // 如果是CPK/CP，初始化range
        if (['CPK', 'CP'].includes(columnId)) {
            setRangeValues(prev => ({
                ...prev,
                [columnId]: {
                    min: filterValues[columnId]?.min ?? '',
                    max: filterValues[columnId]?.max ?? ''
                }
            }));
        }
    };
    
    const handleFilterPopoverClose = () => {
        setFilterAnchorEl(null);
        setFilterColumn(null);
    };
    const filterPopoverOpen = Boolean(filterAnchorEl);

    // CPK/CP区间变更
    const handleRangeChange = (columnId, type, value) => {
        setRangeValues(prev => ({
            ...prev,
            [columnId]: {
                ...prev[columnId],
                [type]: value
            }
        }));
    };

    // 应用CPK/CP区间
    const handleApplyRange = () => {
        setFilterValues(prev => ({
            ...prev,
            [filterColumn]: {
                min: rangeValues[filterColumn]?.min,
                max: rangeValues[filterColumn]?.max
            }
        }));
        setPage(0);
        handleFilterPopoverClose();
    };

    // 其它列输入/选择
    const handleFilterChange = (columnId, value) => {
        setFilterValues(prev => ({
            ...prev,
            [columnId]: value
        }));
        setPage(0);
    };

    // CPK/CP区间输入直接生效
    const handleRangeInput = (columnId, type, value) => {
        setFilterValues(prev => ({
            ...prev,
            [columnId]: {
                ...prev[columnId],
                [type]: value
            }
        }));
        setPage(0);
    };

    // 获取当前列所有唯一选项及其出现次数，按出现次数降序排列
    // 修改 getRankedOptions: 只对CPK/CP做3位小数，NO_OF_DATA保持原样
    const getRankedOptions = (colId) => {
        const isNumeric = columns.find(col => col.id === colId)?.isNumeric;
        const isCpkOrCp = colId === 'CPK' || colId === 'CP';
        // 修改为 pieFilteredData
        const values = pieFilteredData.map(row => {
            let val = row[colId];
            if (colId === 'MeasDate') val = formatMeasDate(val);
            if (isCpkOrCp && val !== undefined && val !== null && val !== '' && !isNaN(val)) {
                val = Number(val).toFixed(3);
            }
            return val;
        }).filter(v => v !== undefined && v !== null && v !== '');
        const unique = Array.from(new Set(values));
        return unique.sort((a, b) => {
            if (isNumeric) {
                const na = parseFloat(a);
                const nb = parseFloat(b);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.toString().localeCompare(b.toString());
            } else {
                return a.toString().localeCompare(b.toString());
            }
        });
    };
    
    const getAllOptions = (colId, inputVal = '', min = '', max = '') => {
        const isNumeric = columns.find(col => col.id === colId)?.isNumeric;
        const isCpkOrCp = colId === 'CPK' || colId === 'CP';
        // 修改为 pieFilteredData
        let values = pieFilteredData.map(row => {
            let val = row[colId];
            if (colId === 'MeasDate') val = formatMeasDate(val);
            if (isCpkOrCp && val !== undefined && val !== null && val !== '' && !isNaN(val)) {
                val = Number(val).toFixed(3);
            }
            return val;
        }).filter(v => v !== undefined && v !== null && v !== '');

        // 区间过滤（仅CPK/CP）
        // 修正：如果min/max都等于某个option，options只显示该option
        if (isCpkOrCp && min !== '' && max !== '' && min === max) {
            values = [min];
        } else if (isCpkOrCp && (min !== '' || max !== '')) {
            const minNum = min !== '' ? parseFloat(min) : -Infinity;
            const maxNum = max !== '' ? parseFloat(max) : Infinity;
            values = values.filter(v => {
                const num = parseFloat(v);
                return !isNaN(num) && num >= minNum && num <= maxNum;
            });
        }

        // 输入过滤
        let filtered = values;
        if (inputVal && inputVal !== '') {
            filtered = values.filter(opt =>
                opt?.toString().toLowerCase().includes(inputVal.toLowerCase())
            );
        }
        const unique = Array.from(new Set(filtered));
        return unique.sort((a, b) => {
            if (isNumeric) {
                const na = parseFloat(a);
                const nb = parseFloat(b);
                if (!isNaN(na) && !isNaN(nb)) return na - nb;
                return a.toString().localeCompare(b.toString());
            } else {
                return a.toString().localeCompare(b.toString());
            }
        });
    };

    const sortedData = React.useMemo(() => {
        if (!queryData || !orderBy) return queryData;
        return [...queryData].sort((a, b) => {
            let aValue, bValue;
            if (orderBy === 'Period') {
                aValue = date;
                bValue = date;
            } else if (orderBy === 'FurtherAnalysis') {
                return 0; // 不排序
            } else {
                aValue = a[orderBy];
                bValue = b[orderBy];
            }
            // Lot No. sorts by its last 7 digits (e.g. 2603_005), ascending.
            if (orderBy === 'LotNo') {
                return order === 'asc'
                    ? compareLotNoLast7(a.LotNo, b.LotNo)
                    : compareLotNoLast7(b.LotNo, a.LotNo);
            }
            // Numeric sort for numeric columns
            if (columns.find(col => col.id === orderBy && col.isNumeric)) {
                aValue = parseFloat(aValue ?? 0);
                bValue = parseFloat(bValue ?? 0);
                return order === 'asc' ? aValue - bValue : bValue - aValue;
            }
            // Default string sort
            return order === 'asc'
                ? (aValue ?? '').toString().localeCompare((bValue ?? '').toString())
                : (bValue ?? '').toString().localeCompare((aValue ?? '').toString());
        });
    }, [queryData, orderBy, order, date]);

    // 过滤掉CPK为0的row
    const filteredData = React.useMemo(() => {
        return sortedData.filter(row => {
            // 只要CPK严格等于0就过滤掉，null/undefined/NaN不算
            const cpk = parseFloat(row.CPK);
            return !(cpk === 0);
        });
    }, [sortedData]);

    const finalFilteredData = React.useMemo(() => {
        return filteredData.filter(row => {
            for (const col of columns) {
                const filterVal = filterValues[col.id];
                if (filterVal && filterVal !== '') {
                    let cellVal = row[col.id];
                    if (col.id === 'MeasDate') cellVal = formatMeasDate(cellVal);
                    if (col.id === 'CPK' || col.id === 'CP') {
                        // 修正：cellVal也要toFixed(3)后再比较
                        const cellValFixed = (cellVal !== undefined && cellVal !== null && cellVal !== '' && !isNaN(cellVal))
                            ? Number(cellVal).toFixed(3)
                            : cellVal;
                        const min = filterVal.min !== undefined && filterVal.min !== '' ? filterVal.min : '';
                        const max = filterVal.max !== undefined && filterVal.max !== '' ? filterVal.max : '';
                        // 如果min/max都等于某个option，直接字符串比较
                        if (min !== '' && max !== '' && min === max) {
                            if (cellValFixed !== min) return false;
                        } else {
                            const minNum = min !== '' ? parseFloat(min) : -Infinity;
                            const maxNum = max !== '' ? parseFloat(max) : Infinity;
                            const numVal = parseFloat(cellValFixed);
                            if (isNaN(numVal) || numVal < minNum || numVal > maxNum) return false;
                        }
                    } else if (col.isNumeric) {
                        if (isNaN(filterVal)) return false;
                        if (parseFloat(cellVal) !== parseFloat(filterVal)) return false;
                    } else {
                        if (!cellVal?.toString().toLowerCase().includes(filterVal.toLowerCase())) return false;
                    }
                }
            }
            return true;
        });
    }, [filteredData, filterValues]);

    // Table数据过滤加上Pie筛选
    const pieFilteredData = React.useMemo(() => {
        return finalFilteredData.filter(row => {
            if (pieFilter.CarbonizingFurnace && row.CarbonizingFurnace !== pieFilter.CarbonizingFurnace) return false;
            if (pieFilter.TemperingFurnace && row.TemperingFurnace !== pieFilter.TemperingFurnace) return false;
            if (pieFilter.MaterialDesc) {
                const matGroup = typeof row.MaterialDesc === 'string' ? row.MaterialDesc.slice(0, 2).toUpperCase() : 'Un';
                if (matGroup !== pieFilter.MaterialDesc) return false;
            }
            return true;
        });
    }, [finalFilteredData, pieFilter]);

    // Pie chart data
    // 这里的 pieData 需要根据 pieFilteredData 计算，保证 pie 选项和 column filter 一样联动
    const carbPieData = getPieData(pieFilteredData, 'CarbonizingFurnace', PIE_COLORS);
    const tempPieData = getPieData(pieFilteredData, 'TemperingFurnace', PIE_COLORS2);
    const materialPieData = getPieData(pieFilteredData, 'MaterialDesc', PIE_COLORS3, { groupMaterial: true });

    // Pie label click handler
    const handlePieLabelClick = (type, label) => {
        setPieFilter(prev => ({
            ...prev,
            [type]: prev[type] === label ? null : label
        }));
        setPage(0);
    };

    // A column is "actively filtered" when it has a non-empty text value or a min/max range (CPK/CP).
    const isColumnFiltered = (colId) => {
        const v = filterValues[colId];
        if (v == null || v === '') return false;
        if (typeof v === 'object') return (v.min ?? '') !== '' || (v.max ?? '') !== '';
        return true;
    };
    const hasActiveFilters = Object.keys(filterValues).some(k => isColumnFiltered(k));

    return (
        <Box sx={{ mt: { xs: 1, sm: 1.5, md: 2 }, mb: { xs: 2, sm: 3, md: 5 }, px: { xs: 1, sm: 1.5, md: 2 }, display: 'flex', gap: { xs: 1, md: 3 }, flexWrap: { xs: 'wrap', md: 'nowrap' }, boxSizing: 'border-box', width: '100%', maxWidth: '100%' }}>
            {/* Filter pie panel on the left, side-by-side with the table (matches OverallLotsClickedTable). */}
            <Box sx={{
                width: leftOpen ? { xs: '100%', md: 360 } : { xs: 24, md: 32 },
                maxWidth: leftOpen ? { xs: '100%', md: 360 } : 'auto',
                transition: 'width 0.2s',
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                alignItems: leftOpen ? 'stretch' : 'center',
                minHeight: { xs: 300, md: 400 },
                position: 'relative',
                flexShrink: 0,
                order: { xs: 2, md: 'unset' }
            }}>
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 8,
                        right: leftOpen ? 8 : 'auto',
                        left: leftOpen ? 'auto' : 0,
                        zIndex: 10,
                        bgcolor: '#222',
                        color: '#fff',
                        borderRadius: 1,
                        width: 32,
                        height: 32,
                    }}
                    onClick={() => setLeftOpen(v => !v)}
                >
                    {leftOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
                </IconButton>
                <Collapse in={leftOpen} orientation="vertical" sx={{ mt: 5 }}>
                    <Box sx={{ p: 2 }}>
                        {/* Unfilter All Pie Selections */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                            <Button
                                variant="contained"
                                color="secondary"
                                size="small"
                                sx={{
                                    fontWeight: 700,
                                    borderRadius: 2,
                                    px: 2,
                                    py: 0.5,
                                    minWidth: 0,
                                    fontSize: 13,
                                }}
                                onClick={() => {
                                    setPieFilter({
                                        CarbonizingFurnace: null,
                                        TemperingFurnace: null,
                                        MaterialDesc: null
                                    });
                                    setFilterValues({});
                                    setPage(0);
                                }}
                            >
                                Unfilter All
                            </Button>
                        </Box>
                        {/* Carbonizing Furnace Pie */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'text.primary', textAlign: 'center', fontWeight: 700 }}>
                                Carburizing Furnace
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', height: 'auto' }}>
                                    <PieChart
                                        series={[{
                                            data: carbPieData.length ? carbPieData : [{ label: 'No Data', value: 1, color: 'rgba(148,163,184,0.18)' }],
                                            highlightScope: { faded: 'global', highlighted: 'item' },
                                            cornerRadius: 6,
                                            paddingAngle: 2,
                                            innerRadius: 45,
                                            outerRadius: 90,
                                            cx: 100,
                                            cy: 100,
                                        }]}
                                        legend={{ hidden: true }}
                                        width={200}
                                        height={Math.max(200, carbPieData.length * 40)}
                                    />
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-start',
                                }}>
                                    {/* Pie filtering as column filtering: show options, highlight selected, click to filter */}
                                    {carbPieData.map((item, idx) => (
                                        <Box
                                            key={item.label}
                                            sx={{
                                                cursor: 'pointer',
                                                px: 1,
                                                py: 1,
                                                borderRadius: 1,
                                                background: pieFilter.CarbonizingFurnace === item.label ? item.color : undefined,
                                                color: pieFilter.CarbonizingFurnace === item.label ? '#222' : item.color,
                                                fontWeight: pieFilter.CarbonizingFurnace === item.label ? 700 : undefined,
                                                border: `1px solid ${item.color}`,
                                                mb: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                whiteSpace: 'nowrap',
                                                '&:hover': {
                                                    background: item.color,
                                                    color: '#222'
                                                },
                                            }}
                                            onClick={() => {
                                                setPieFilter(prev => ({
                                                    ...prev,
                                                    CarbonizingFurnace: prev.CarbonizingFurnace === item.label ? null : item.label
                                                }));
                                                setPage(0);
                                            }}
                                        >
                                            {item.label} ({item.value})
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                        {/* Tempering Furnace Pie */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'text.primary', textAlign: 'center', fontWeight: 700 }}>
                                Tempering Furnace
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', height: 'auto' }}>
                                    <PieChart
                                        series={[{
                                            data: tempPieData.length ? tempPieData : [{ label: 'No Data', value: 1, color: 'rgba(148,163,184,0.18)' }],
                                            highlightScope: { faded: 'global', highlighted: 'item' },
                                            cornerRadius: 6,
                                            paddingAngle: 2,
                                            innerRadius: 45,
                                            outerRadius: 90,
                                            cx: 100,
                                            cy: 100,
                                        }]}
                                        legend={{ hidden: true }}
                                        width={200}
                                        height={Math.max(200, tempPieData.length * 40)}
                                    />
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-start',
                                }}>
                                    {tempPieData.map((item, idx) => (
                                        <Box
                                            key={item.label}
                                            sx={{
                                                cursor: 'pointer',
                                                px: 1,
                                                py: 1,
                                                borderRadius: 1,
                                                background: pieFilter.TemperingFurnace === item.label ? item.color : undefined,
                                                color: pieFilter.TemperingFurnace === item.label ? '#222' : item.color,
                                                fontWeight: pieFilter.TemperingFurnace === item.label ? 700 : undefined,
                                                border: `1px solid ${item.color}`,
                                                mb: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                whiteSpace: 'nowrap',
                                                '&:hover': {
                                                    background: item.color,
                                                    color: '#222'
                                                },
                                            }}
                                            onClick={() => {
                                                setPieFilter(prev => ({
                                                    ...prev,
                                                    TemperingFurnace: prev.TemperingFurnace === item.label ? null : item.label
                                                }));
                                                setPage(0);
                                            }}
                                        >
                                            {item.label} ({item.value})
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                        {/* Material Desc Pie */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'text.primary', textAlign: 'center', fontWeight: 700 }}>
                                Product Group
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', height: 'auto' }}>
                                    <PieChart
                                        series={[{
                                            data: materialPieData.length ? materialPieData : [{ label: 'No Data', value: 1, color: 'rgba(148,163,184,0.18)' }],
                                            arcLabelMinAngle: 0,
                                            highlightScope: { faded: 'global', highlighted: 'item' },
                                            cornerRadius: 6,
                                            paddingAngle: 2,
                                            innerRadius: 45,
                                            outerRadius: 90,
                                            cx: 100,
                                            cy: 100,
                                        }]}
                                        legend={{ hidden: true }}
                                        width={200}
                                        height={Math.max(200, materialPieData.length * 40)}
                                    />
                                </Box>
                                <Box sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1,
                                    alignItems: 'flex-start',
                                    justifyContent: 'flex-start',
                                }}>
                                    {materialPieData.map((item, idx) => (
                                        <Box
                                            key={item.label}
                                            sx={{
                                                cursor: 'pointer',
                                                px: 2,
                                                py: 1,
                                                borderRadius: 1,
                                                background: pieFilter.MaterialDesc === item.label ? item.color : undefined,
                                                color: pieFilter.MaterialDesc === item.label ? '#222' : item.color,
                                                fontWeight: pieFilter.MaterialDesc === item.label ? 700 : undefined,
                                                border: `1px solid ${item.color}`,
                                                mb: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                whiteSpace: 'nowrap',
                                                '&:hover': {
                                                    background: item.color,
                                                    color: '#222'
                                                },
                                            }}
                                            onClick={() => {
                                                setPieFilter(prev => ({
                                                    ...prev,
                                                    MaterialDesc: prev.MaterialDesc === item.label ? null : item.label
                                                }));
                                                setPage(0);
                                            }}
                                        >
                                            {item.label} ({item.value})
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Collapse>
            </Box>
            {/* 右侧主表格内容区域 */}
            <Box sx={{ flex: 1, minWidth: 0, order: { xs: 1, md: 'unset' }, width: { xs: '100%', md: 'auto' }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: { xs: 2, md: 3 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, mb: 1 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="h4" gutterBottom sx={{ mb: 0.5 }}>
                        {`${seriesId.slice(0, 2) === 'nc'? 'CPK < 1' : 'CPK ≥ 1'} Individual Lot Measurement Table`}
                    </Typography>
                    <Typography variant="h6" sx={{ mb: 0 }}>
                        {
                            periodType === 'month'
                                ? `MeasDate: ${formatMonthYear(date?.substring(0, 7)) || 'No date provided'}`
                                : periodType === 'date'
                                    ? `MeasDate: ${formatMonthDate(date) || 'No date provided'}`
                                    : 'No period info'
                        }
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    {hasActiveFilters && (
                        <IconButton
                            size="small"
                            title="Clear all column filters"
                            onClick={() => { setFilterValues({}); setPage(0); }}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                        >
                            <FilterAltOffIcon fontSize="small" />
                        </IconButton>
                    )}
                    {!loading && pieFilteredData.length > 0 && (
                    <CsvExportButton
                        data={pieFilteredData}
                        headers={columns.filter(col => col.id !== 'FurtherAnalysis').map(col => col.id)}
                        filename={`${seriesId.slice(0, 2) === 'nc' ? 'Cpk＜1' : 'Cpk≥1'} Individual Lot Measurement Table_${periodType === 'date' ? formatDayMonthYear(date) : formatMonthYear(date?.substring(0, 7))}.csv`}
                        generalInfo={[
                            { label: 'Report', value: 'Individual Lot Measurement Table' },
                            { label: 'MeasDate', value: formatMonthYear(date?.substring(0, 7)) },
                            { label: 'Dept', value: pieFilteredData[0]?.Dept || '' },
                        ]}
                        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                        Download Individual Lot Data
                    </CsvExportButton>
                    )}
                  </Box>
                </Box>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <CircularProgress disableShrink color="primary" sx={{ height: '100vh' }} />
                    </Box>
                ) : queryData.length > 0 ? (
                    <>
                        <TableContainer component={Paper}>
                            <Table
                                sx={{
                                    '& .MuiTableCell-root': { fontSize: "0.82rem !important" },
                                    // Branded header band (nav indigo + light text; readable in light & dark).
                                    '& .MuiTableHead-root .MuiTableCell-root': {
                                        fontSize: "0.82rem !important", fontWeight: "bold !important",
                                        backgroundColor: 'custom.nav', color: 'custom.navText',
                                    },
                                    '& .MuiTableHead-root .MuiTableSortLabel-root, & .MuiTableHead-root .MuiTableSortLabel-root:hover, & .MuiTableHead-root .MuiTableSortLabel-root.Mui-active': { color: 'custom.navText' },
                                    '& .MuiTableHead-root .MuiTableSortLabel-icon': { color: 'custom.navText !important' },
                                    '& .MuiTableHead-root .MuiIconButton-root': { color: 'custom.navText' },
                                    '& .MuiTableSortLabel-root': { fontSize: "0.82rem !important" },
                                }}
                            >
                                <TableHead>
                                    <TableRow>
                                        {columns.map(col => (
                                            <TableCell
                                                key={col.id}
                                                sortDirection={orderBy === col.id ? order : false}
                                                sx={col.minWidth ? { minWidth: col.minWidth } : undefined}
                                            >
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    {col.id !== 'FurtherAnalysis' ? (
                                                        <TableSortLabel
                                                            active={orderBy === col.id}
                                                            direction={orderBy === col.id ? order : 'asc'}
                                                            onClick={() => handleRequestSort(col.id)}
                                                        >
                                                            {col.label}
                                                        </TableSortLabel>
                                                    ) : col.label}
                                                    {/* 每列都有自己的filter按钮 */}
                                                    {col.id !== 'FurtherAnalysis' && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={e => handleFilterIconClick(e, col.id)}
                                                            sx={{ ml: 1 }}
                                                        >
                                                            <FilterListIcon fontSize="small" sx={{ color: isColumnFiltered(col.id) ? '#FFC107' : 'inherit' }} />
                                                        </IconButton>
                                                    )}
                                                </Box>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {pieFilteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                                        <TableRow key={index}  
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => {
                                                        drill('lots-sample-distribution-table', {
                                                            state: { 
                                                                Period:date,
                                                                row,
                                                                displayPP:false,},
                                                        });
                                                    }}>
                                            <TableCell sx={{ minWidth: 68 }}>{row.LotNo}</TableCell>
                                            <TableCell>{formatMeasDate(row.MeasDate)}</TableCell>
                                            <TableCell sx={{ minWidth: 39 }}>{row.Dept}</TableCell>
                                            <TableCell>{row.MachineId}</TableCell>
                                            <TableCell>{row.MaterialDesc}</TableCell>
                                            <TableCell>{row.DimensionDesc}</TableCell>
                                            <TableCell>{row.CAT}</TableCell>
                                            <TableCell
                                                sx={{
                                                    backgroundColor: parseFloat(row.CPK) <= MAX_NC ? '#F54D41' : 'inherit',
                                                    color: parseFloat(row.CPK) <= MAX_NC ? 'white' : 'inherit',
                                                }}
                                            >
                                                {row.CPK !== undefined && row.CPK !== null && !isNaN(row.CPK)
                                                    ? Number(row.CPK).toFixed(3)
                                                    : formatMetric(row.CPK, row.NO_OF_DATA)}
                                            </TableCell>
                                            <TableCell
                                                sx={{
                                                    backgroundColor: parseFloat(row.CP) <= MAX_NC ? '#F54D41' : 'inherit',
                                                    color: parseFloat(row.CP) <= MAX_NC ? 'white' : 'inherit',
                                                }}
                                            >
                                                {row.CP !== undefined && row.CP !== null && !isNaN(row.CP)
                                                    ? Number(row.CP).toFixed(3)
                                                    : formatMetric(row.CP, row.NO_OF_DATA)}
                                            </TableCell>
                                            <TableCell sx={{ minWidth: 39 }}>{row.NO_OF_DATA}</TableCell>
                                            <TableCell sx={{ minWidth: 49 }}>{row.CarbonizingFurnace}</TableCell>
                                            <TableCell sx={{ minWidth: 59 }}>{row.TemperingFurnace}</TableCell>
                                            <TableCell sx={{ p: 0.5, textAlign: 'center' }}>
                                                <Button
                                                    variant="contained"
                                                    color="primary"
                                                    size="small"
                                                    sx={{ minWidth: 0, width: 40, height: 32, p: 0 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // don't also fire the row's onClick (double history entry)
                                                        drill('lots-sample-distribution-table', {
                                                            state: {
                                                                Period:date,
                                                                row,
                                                                displayPP:false,},
                                                        });
                                                    }}
                                                >
                                                    <AssessmentIcon fontSize="small" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {/* Keep the header (and its filter-popover anchors) mounted when a
                                        column filter narrows the result to zero rows — otherwise the
                                        popover loses its anchor and jumps to the top-left corner. */}
                                    {pieFilteredData.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={columns.length} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                No matching results.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[100, 500, 1000]}
                            component="div"
                            count={finalFilteredData.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={handleChangePage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                        />
                    </>
                ) : (
                    <Typography variant="body1">No data available for the selected date.</Typography>
                )}
                {/* 每列自己的filter Popover，带下拉和输入 */}
                <Popover
                    open={filterPopoverOpen}
                    anchorEl={filterAnchorEl}
                    onClose={handleFilterPopoverClose}
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                >
                    <Box sx={{ p: 2, minWidth: 240 }}>
                        {filterColumn && (
                            <>
                                {/* CPK/CP区间选择，输入即生效，options随区间变化，可以点选option自动填入区间 */}
                                {['CPK', 'CP'].includes(filterColumn) ? (
                                    <>
                                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Range</Typography>
                                        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                            <TextField
                                                label="Min"
                                                size="small"
                                                variant="outlined"
                                                value={filterValues[filterColumn]?.min ?? ''}
                                                onChange={e => handleRangeInput(filterColumn, 'min', e.target.value)}
                                                type="number"
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start">&ge;</InputAdornment>
                                                }}
                                                fullWidth
                                            />
                                            <TextField
                                                label="Max"
                                                size="small"
                                                variant="outlined"
                                                value={filterValues[filterColumn]?.max ?? ''}
                                                onChange={e => handleRangeInput(filterColumn, 'max', e.target.value)}
                                                type="number"
                                                InputProps={{
                                                    startAdornment: <InputAdornment position="start">&le;</InputAdornment>
                                                }}
                                                fullWidth
                                            />
                                        </Box>
                                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Options</Typography>
                                        <Box sx={{
                                            mb: 1,
                                            maxHeight: 240,
                                            overflowY: 'auto',
                                            border: '1px solid', borderColor: 'divider',
                                            borderRadius: 1,
                                            p: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            fontSize: '1rem',
                                        }}>
                                            {(() => {
                                                const min = filterValues[filterColumn]?.min ?? '';
                                                const max = filterValues[filterColumn]?.max ?? '';
                                                const options = getAllOptions(filterColumn, '', min, max);
                                                return (
                                                    <>
                                                        {options.length === 0 && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, px: 2 }}>
                                                                No matching result
                                                            </Typography>
                                                        )}
                                                        {options.map(option => (
                                                            <Box
                                                                key={option}
                                                                sx={{
                                                                    cursor: 'pointer',
                                                                    px: 2,
                                                                    py: 1,
                                                                    borderRadius: 1,
                                                                    fontSize: '1rem',
                                                                    minHeight: 40,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    color: 'text.primary',
                                                                    '&:hover': {
                                                                        bgcolor: 'primary.main',
                                                                        color: 'primary.contrastText'
                                                                    },
                                                                }}
                                                                onClick={() => {
                                                                    // 选中option后自动填入区间
                                                                    setFilterValues(prev => ({
                                                                        ...prev,
                                                                        [filterColumn]: {
                                                                            min: option,
                                                                            max: option
                                                                        }
                                                                    }));
                                                                    setPage(0);
                                                                }}
                                                            >
                                                                {option}
                                                            </Box>
                                                        ))}
                                                    </>
                                                );
                                            })()}
                                        </Box>
                                        {/* 清除选项始终在最下方 */}
                                        <Box
                                            sx={{
                                                cursor: 'pointer',
                                                px: 2,
                                                py: 1,
                                                borderRadius: 1,
                                                color: 'text.primary',
                                                mt: 1,
                                                fontSize: '1rem',
                                                minHeight: 40,
                                                display: 'flex',
                                                alignItems: 'center',
                                                '&:hover': { background: '#1976d2', color: '#fff' },
                                                flexShrink: 0
                                            }}
                                            onClick={() => setFilterValues(prev => ({ ...prev, [filterColumn]: { min: '', max: '' } }))}
                                        >
                                            Clear Selection
                                        </Box>
                                    </>
                                ) : (
                                    <>
                                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Input</Typography>
                                        <TextField
                                            label={columns.find(col => col.id === filterColumn)?.label}
                                            size="small"
                                            variant="outlined"
                                            value={filterValues[filterColumn] || ''}
                                            onChange={e => handleFilterChange(filterColumn, e.target.value)}
                                            type={columns.find(col => col.id === filterColumn)?.isNumeric ? 'number' : 'text'}
                                            fullWidth
                                            autoFocus
                                            sx={{ mb: 1 }}
                                        />
                                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Options</Typography>
                                        <Box sx={{
                                            maxHeight: 240,
                                            overflowY: 'auto',
                                            border: '1px solid', borderColor: 'divider',
                                            borderRadius: 1,
                                            p: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            fontSize: '1rem'
                                        }}>
                                            {(() => {
                                                const options = getAllOptions(filterColumn, filterValues[filterColumn] || '');
                                                return (
                                                    <>
                                                        {options.length === 0 && (
                                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, px: 2 }}>
                                                                No matching result
                                                            </Typography>
                                                        )}
                                                        {options.map(option => (
                                                            <Box
                                                                key={option}
                                                                sx={{
                                                                    cursor: 'pointer',
                                                                    px: 2,
                                                                    py: 1,
                                                                    borderRadius: 1,
                                                                    transition: 'background 0.15s',
                                                                    background: filterValues[filterColumn] === option
                                                                        ? '#1976d2'
                                                                        : undefined,
                                                                    color: filterValues[filterColumn] === option
                                                                        ? '#fff'
                                                                        : undefined,
                                                                    fontWeight: filterValues[filterColumn] === option ? 600 : undefined,
                                                                    fontSize: '1rem',
                                                                    minHeight: 40,
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    '&:hover': {
                                                                        background: '#1976d2',
                                                                        color: '#fff'
                                                                    },
                                                                }}
                                                                onClick={() => {
                                                                    // 在其它列的options点击时，直接用option字符串（已是toFixed(3)后的字符串）作为filter值
                                                                    handleFilterChange(filterColumn, option)
                                                                }}
                                                            >
                                                                {option}
                                                            </Box>
                                                        ))}
                                                    </>
                                                );
                                            })()}
                                        </Box>
                                        <Box
                                            sx={{
                                                cursor: 'pointer',
                                                px: 2,
                                                py: 1,
                                                borderRadius: 1,
                                                color: 'text.primary',
                                                mt: 1,
                                                fontSize: '1rem',
                                                minHeight: 40,
                                                display: 'flex',
                                                alignItems: 'center',
                                                '&:hover': { background: '#1976d2', color: '#fff' },
                                                flexShrink: 0
                                            }}
                                            onClick={() => handleFilterChange(filterColumn, '')}
                                        >
                                            Clear Selection
                                        </Box>
                                    </>
                                )}
                            </>
                        )}
                    </Box>
                </Popover>
            </Box>
        </Box>
    );
};

export default IndividualLotClickedTable;
