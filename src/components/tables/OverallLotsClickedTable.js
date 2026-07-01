import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, TablePagination, Collapse } from '@mui/material';
import { formatMetric } from '../../utils/metricFormat';
import axios from 'axios';
import AssessmentIcon from '@mui/icons-material/Assessment';
import HistoryIcon from '@mui/icons-material/History';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import TableSortLabel from '@mui/material/TableSortLabel';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import FilterListIcon from '@mui/icons-material/FilterList';
import Popover from '@mui/material/Popover';
import InputAdornment from '@mui/material/InputAdornment';
import CsvExportButton from '../CsvExportButton';
import { PieChart } from '@mui/x-charts/PieChart';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

function formatMonthYear(monthStr) {
    if (!monthStr) return '';
    // 强制转字符串，兼容数字类型
    const str = String(monthStr);
    // 支持 "202404" 或 "2024-04"
    if (/^\d{6}$/.test(str)) {
        // "202404" => "2024-04"
        return formatMonthYear(str.slice(0, 4) + '-' + str.slice(4, 6));
    }
    const [year, month] = str.split('-');
    if (!year || !month) return str;
    const date = new Date(`${year}-${month}-01`);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`; // 'Feb 2024'
}

const columns = [
    { id: 'Period', label: 'Period', getValue: (row, date) => formatMonthYear(date) },
    { id: 'Dept', label: 'Dept' },
    { id: 'MachineId', label: 'MachineId' },
    { id: 'MaterialDesc', label: 'MaterialDesc' },
    { id: 'DimensionDesc', label: 'DimensionDesc' },
    { id: 'CAT', label: 'CAT' },
    { id: 'CPK_NC_Percentage', label: 'CPK<1 Lot' },
    { id: 'CPK', label: 'CPK', isNumeric: true },
    { id: 'PPK', label: 'PPK', isNumeric: true },
    { id: 'CP', label: 'CP', isNumeric: true },
    { id: 'PP', label: 'PP', isNumeric: true },
    { id: 'NO_OF_DATA', label: 'No of Data', isNumeric: true },
    { id: 'BatchMC2', label: 'CarburizingFurnace' },
    { id: 'BatchMC4', label: 'TemperingFurnace' },
    { id: 'FurtherAnalysis', label: 'Analysis' },
];

const MAX_NC = 0.9949;

const OverallLotsClickedTable = () => {
    const location = useLocation();
    const { state = {} } = location || {};
    const { date, metric, resultType } = state;
    const [queryData, setQueryData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0); // 当前页码
    const [rowsPerPage, setRowsPerPage] = useState(500); // 每页显示的行数
    const [orderBy, setOrderBy] = useState('Period');
    const [order, setOrder] = useState('asc');
    const [filterValues, setFilterValues] = useState({});
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [filterColumn, setFilterColumn] = useState(null);
    const [leftOpen, setLeftOpen] = useState(true);
    const navigate = useNavigate();

    console.log('Component mounted with state:', state);

    useEffect(() => {
        console.log('State from navigation:', state);
        if (state && state.date) {
            const fetchData = async () => {
                setLoading(true);
                try {
                    const response = await axios.get(`${window.baseURL}/overall-lots-one-month-detail`, { params: state });
                    console.log('Fetched data:', response.data);
                    setQueryData(response.data);
                } catch (error) {
                    console.error('Error fetching data:', error);
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        }
    }, [state]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0); // 重置到第一页
    };

    const handleRequestSort = (columnId) => {
        const isAsc = orderBy === columnId && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(columnId);
    };

    // 排序逻辑
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

    // Filtering logic (same as IndividualLotsClickedTable, but for this table)
    const handleFilterIconClick = (event, columnId) => {
        setFilterAnchorEl(event.currentTarget);
        setFilterColumn(columnId);
    };
    const handleFilterPopoverClose = () => {
        setFilterAnchorEl(null);
        setFilterColumn(null);
    };
    const filterPopoverOpen = Boolean(filterAnchorEl);

    const handleFilterChange = (columnId, value) => {
        setFilterValues(prev => ({
            ...prev,
            [columnId]: value
        }));
        setPage(0);
    };

    // Only CPK/CP/PPK/PP/CPK_NC_Percentage use 3 decimals
    const is3DecimalCol = colId => ['CPK', 'CP', 'PPK', 'PP', 'CPK_NC_Percentage'].includes(colId);

    // Get all unique options for a column, with 3 decimals for numeric
    const getAllOptions = (colId, inputVal = '', min = '', max = '') => {
        // 确保 inputVal 是字符串（防止对象/数组的 toLowerCase() 错误）
        inputVal = typeof inputVal === 'string' ? inputVal : '';

        // 1. 获取剔除当前列过滤条件后的数据，使选项随其他列(包括Pie)变化
        const otherFilters = { ...filterValues };
        delete otherFilters[colId];
        const relevantData = applyFilters(sortedData, otherFilters);
        
        // 对于 MaterialDesc，返回前两个字母分组，保持与 pie chart 一致
        if (colId === 'MaterialDesc') {
            const groups = new Set();
            relevantData.forEach(row => {
                const val = row.MaterialDesc;
                if (val && val !== '') {
                    const items = val.split(',').map(item => item.trim()).filter(item => item !== '');
                    items.forEach(item => {
                        groups.add(item.slice(0, 2));
                    });
                }
            });
            let unique = Array.from(groups).sort();
            
            // Input filter
            if (inputVal && inputVal !== '') {
                unique = unique.filter(opt =>
                    opt?.toString().toLowerCase().includes(inputVal.toLowerCase())
                );
            }
            return unique;
        }
        
        const isNumeric = columns.find(col => col.id === colId)?.isNumeric;
        const is3Dec = is3DecimalCol(colId);
        let values = relevantData.map(row => {
            let val = row[colId];
            if (is3Dec && val !== undefined && val !== null && val !== '' && !isNaN(val)) {
                val = Number(val).toFixed(3);
            }
            return val;
        }).filter(v => v !== undefined && v !== null && v !== '');

        // 区间过滤（仅3位小数的列）
        if (is3Dec && (min !== '' || max !== '')) {
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

    // 为BatchMC2和BatchMC4获取所有unique furnace
    const getUniqueFurnaces = (colId) => {
        const furnaces = new Set();
        // 1. 获取剔除当前列过滤条件后的数据
        const otherFilters = { ...filterValues };
        delete otherFilters[colId];
        const relevantData = applyFilters(sortedData, otherFilters);

        relevantData.forEach(row => {
            const val = row[colId];
            if (val && val !== '') {
                const items = val.split(',').map(item => item.trim()).filter(item => item !== '');
                items.forEach(item => furnaces.add(item));
            }
        });
        return Array.from(furnaces).sort();
    };

    // 为MaterialDesc获取所有unique的前两个字母groups
    const getUniqueMaterialGroups = () => {
        const otherFilters = { ...filterValues };
        delete otherFilters['MaterialDesc'];
        const relevantData = applyFilters(sortedData, otherFilters);
        
        const groups = new Set();
        relevantData.forEach(row => {
            const val = row.MaterialDesc;
            if (val && val !== '') {
                const items = val.split(',').map(item => item.trim()).filter(item => item !== '');
                items.forEach(item => {
                    groups.add(item.slice(0, 2));
                });
            }
        });
        return Array.from(groups).sort();
    };

    const applyFilters = React.useCallback((data, filters) => {
        return data.filter(row => {
            for (const col of columns) {
                const filterVal = filters[col.id];
                if (!filterVal || (Array.isArray(filterVal) && filterVal.length === 0)) continue;
                const cellVal = row[col.id];

                if ((col.id === 'BatchMC2' || col.id === 'BatchMC4') && Array.isArray(filterVal) && filterVal.length > 0) {
                    const rowFurnaces = cellVal ? cellVal.split(',').map(v => v.trim()) : [];
                    if (!filterVal.some(selected => rowFurnaces.includes(selected))) return false;
                } else if (col.id === 'MaterialDesc' && Array.isArray(filterVal) && filterVal.length > 0) {
                    const rowMaterials = cellVal ? cellVal.split(',').map(v => v.trim()) : [];
                    if (!filterVal.some(selectedGroup => rowMaterials.some(mat => mat.slice(0, 2) === selectedGroup))) return false;
                } else if (is3DecimalCol(col.id)) {
                    const cellNum = (cellVal !== undefined && cellVal !== null && cellVal !== '' && !isNaN(cellVal)) ? Number(cellVal).toFixed(3) : cellVal;
                    if (typeof filterVal === 'object' && filterVal.min !== undefined) {
                        const min = filterVal.min !== '' ? parseFloat(filterVal.min) : -Infinity;
                        const max = filterVal.max !== '' ? parseFloat(filterVal.max) : Infinity;
                        const numVal = parseFloat(cellNum);
                        if (isNaN(numVal) || numVal < min || numVal > max) return false;
                    }
                } else if (col.isNumeric) {
                    if (parseFloat(cellVal) !== parseFloat(filterVal)) return false;
                } else if (typeof filterVal === 'string') {
                    if (!cellVal?.toString().toLowerCase().includes(filterVal.toLowerCase())) return false;
                }
            }
            return true;
        });
    }, []);

    const finalFilteredData = React.useMemo(() => {
        return applyFilters(sortedData, filterValues);
    }, [sortedData, filterValues, applyFilters]);

    const generatePieData = React.useCallback((sourceData, allFilters, pieKey, pieGroupKey) => {
        const crossFilters = { ...allFilters };
        delete crossFilters[pieKey];

        const dataForPie = applyFilters(sourceData, crossFilters);

        const counts = {};
        dataForPie.forEach(row => {
            const value = row[pieKey];
            if (value) {
                const items = value.split(',').map(v => v.trim()).filter(Boolean);
                items.forEach(item => {
                    const key = pieGroupKey === 'MaterialDesc' ? item.slice(0, 2) : item;
                    counts[key] = (counts[key] || 0) + 1;
                });
            }
        });

        const labels = Object.keys(counts).sort();
        const colors = {};
        labels.forEach((label, idx) => {
            const hue = (idx * 45) % 360;
            colors[label] = `hsl(${hue}, 70%, 60%)`;
        });

        const pieData = labels.map(label => ({
            label,
            value: counts[label],
            color: colors[label],
        }));

        const currentFilter = allFilters[pieKey];
        if (currentFilter && currentFilter.length > 0) {
            return pieData.filter(d => currentFilter.includes(d.label));
        }
        return pieData;
    }, [applyFilters]);

    const carbPieData = React.useMemo(() => {
        return generatePieData(sortedData, filterValues, 'BatchMC2');
    }, [sortedData, filterValues, generatePieData]);

    const tempPieData = React.useMemo(() => {
        return generatePieData(sortedData, filterValues, 'BatchMC4');
    }, [sortedData, filterValues, generatePieData]);

    const materialPieData = React.useMemo(() => {
        return generatePieData(sortedData, filterValues, 'MaterialDesc', 'MaterialDesc');
    }, [sortedData, filterValues, generatePieData]);

    const handlePieClick = (filterKey, value) => {
        const currentSelection = filterValues[filterKey] || [];
        const newSelection = currentSelection.includes(value) ? [] : [value];
        setFilterValues(prev => ({ ...prev, [filterKey]: newSelection }));
        setPage(0);
    };

    return (
        <Box sx={{ mt: { xs: 1, sm: 1.5, md: 2 }, mb: { xs: 2, sm: 3, md: 5 }, px: { xs: 1, sm: 1.5, md: 2 }, display: 'flex', gap: { xs: 1, md: 3 }, flexWrap: { xs: 'wrap', md: 'nowrap' }, boxSizing: 'border-box', width: '100%', maxWidth: '100%' }}>
            {/* 左侧 foldable tabs 区域 */}
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
                                    setFilterValues({}); // This now clears all filters
                                    setPage(0);
                                }}
                            >
                                Unfilter All
                            </Button>
                        </Box>
                        {/* Carbonizing Furnace Pie */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'primary.main', textAlign: 'center', fontWeight: 700 }}>
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
                                    {(filterValues.BatchMC2 && filterValues.BatchMC2.length > 0) ? (
                                        <Box
                                            key={filterValues.BatchMC2[0]}
                                            sx={{
                                                cursor: 'pointer',
                                                px: 1,
                                                py: 1,
                                                borderRadius: 1,
                                                background: carbPieData.find(item => item.label === filterValues.BatchMC2[0])?.color || '#90caf9',
                                                color: '#222',
                                                fontWeight: 700,
                                                border: `1px solid ${carbPieData.find(item => item.label === filterValues.BatchMC2[0])?.color || '#90caf9'}`,
                                                mb: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                whiteSpace: 'nowrap',
                                                '&:hover': {
                                                    opacity: 0.8
                                                },
                                            }}
                                            onClick={() => handlePieClick('BatchMC2', filterValues.BatchMC2[0])}
                                        >
                                            {filterValues.BatchMC2[0]} ({carbPieData.find(item => item.label === filterValues.BatchMC2[0])?.value || 0})
                                        </Box>
                                    ) : (
                                        carbPieData.map((item) => (
                                            <Box
                                                key={item.label}
                                                sx={{
                                                    cursor: 'pointer',
                                                    px: 1,
                                                    py: 1,
                                                    borderRadius: 1,
                                                    background: undefined,
                                                    color: item.color,
                                                    fontWeight: 500,
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
                                                onClick={() => handlePieClick('BatchMC2', item.label)}
                                            >
                                                {item.label} ({item.value})
                                            </Box>
                                        ))
                                    )}
                                </Box>
                            </Box>
                        </Box>
                        {/* Tempering Furnace Pie */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'success.main', textAlign: 'center', fontWeight: 700 }}>
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
                                    {(filterValues.BatchMC4 && filterValues.BatchMC4.length > 0) ? (
                                        <Box
                                            key={filterValues.BatchMC4[0]}
                                            sx={{
                                                cursor: 'pointer',
                                                px: 1,
                                                py: 1,
                                                borderRadius: 1,
                                                background: tempPieData.find(item => item.label === filterValues.BatchMC4[0])?.color || '#a5d6a7',
                                                color: '#222',
                                                fontWeight: 700,
                                                border: `1px solid ${tempPieData.find(item => item.label === filterValues.BatchMC4[0])?.color || '#a5d6a7'}`,
                                                mb: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                whiteSpace: 'nowrap',
                                                '&:hover': {
                                                    opacity: 0.8
                                                },
                                            }}
                                            onClick={() => handlePieClick('BatchMC4', filterValues.BatchMC4[0])}
                                        >
                                            {filterValues.BatchMC4[0]} ({tempPieData.find(item => item.label === filterValues.BatchMC4[0])?.value || 0})
                                        </Box>
                                    ) : (
                                        tempPieData.map((item) => (
                                            <Box
                                                key={item.label}
                                                sx={{
                                                    cursor: 'pointer',
                                                    px: 1,
                                                    py: 1,
                                                    borderRadius: 1,
                                                    background: undefined,
                                                    color: item.color,
                                                    fontWeight: 500,
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
                                                onClick={() => handlePieClick('BatchMC4', item.label)}
                                            >
                                                {item.label} ({item.value})
                                            </Box>
                                        ))
                                    )}
                                </Box>
                            </Box>
                        </Box>
                        {/* Material Desc Pie */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ mb: 1, color: 'warning.main', textAlign: 'center', fontWeight: 700 }}>
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
                                    {(filterValues.MaterialDesc && filterValues.MaterialDesc.length > 0) ? (
                                        <Box
                                            key={filterValues.MaterialDesc[0]}
                                            sx={{
                                                cursor: 'pointer',
                                                px: 2,
                                                py: 1,
                                                borderRadius: 1,
                                                background: materialPieData.find(item => item.label === filterValues.MaterialDesc[0])?.color || '#ffd54f',
                                                color: '#222',
                                                fontWeight: 700,
                                                border: `1px solid ${materialPieData.find(item => item.label === filterValues.MaterialDesc[0])?.color || '#ffd54f'}`,
                                                mb: 1,
                                                minWidth: 0,
                                                fontSize: 13,
                                                whiteSpace: 'nowrap',
                                                '&:hover': {
                                                    opacity: 0.8
                                                },
                                            }}
                                            onClick={() => handlePieClick('MaterialDesc', filterValues.MaterialDesc[0])}
                                        >
                                            {filterValues.MaterialDesc[0]} ({materialPieData.find(item => item.label === filterValues.MaterialDesc[0])?.value || 0})
                                        </Box>
                                    ) : (
                                        materialPieData.map((item) => (
                                            <Box
                                                key={item.label}
                                                sx={{
                                                    cursor: 'pointer',
                                                    px: 2,
                                                    py: 1,
                                                    borderRadius: 1,
                                                    background: undefined,
                                                    color: item.color,
                                                    fontWeight: 500,
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
                                                onClick={() => handlePieClick('MaterialDesc', item.label)}
                                            >
                                                {item.label} ({item.value})
                                            </Box>
                                        ))
                                    )}
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Collapse>
            </Box>

            {/* 右侧表格区域 */}
            <Box sx={{ flex: 1, minWidth: 0, order: { xs: 1, md: 'unset' }, width: { xs: '100%', md: 'auto' }, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: { xs: 2, md: 3 } }}>
                {/* 标题与导出按钮同一行：标题左，下载按钮右 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="h4" gutterBottom sx={{ fontSize: { xs: 'h5.fontSize', sm: 'h4.fontSize' }, mb: 0.5 }}>
                            {metric}
                            {resultType === 'ac' ? ' ≥ 1 ' : '< 1 '}
                            Dimension Measurement Table
                            {/* Dimension One Month Table */}
                        </Typography>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: 'body1.fontSize', sm: 'h6.fontSize' }, mb: 0 }}>
                            Period: {formatMonthYear(date) || 'No date provided'}
                        </Typography>
                    </Box>
                    <CsvExportButton
                        data={finalFilteredData}
                        headers={columns.filter(col => col.id !== 'FurtherAnalysis').map(col => col.id)}
                        filename={`Dimension_Measurement_${formatMonthYear(date) || 'Export'}.csv`}
                        generalInfo={[
                            { label: 'Report', value: 'Dimension Measurement Table' },
                            { label: 'Metric', value: metric },
                            { label: 'Result', value: resultType === 'ac' ? 'CPK ≥ 1' : 'CPK < 1' },
                            { label: 'Period', value: formatMonthYear(date) },
                            { label: 'Dept', value: state.Dept || 'HT' },
                            { label: 'MachineId', value: state.MachineId || '' },
                            { label: 'CAT', value: Array.isArray(state.CAT) ? state.CAT.join(', ') : (state.CAT || '') },
                        ]}
                        sx={{ flexShrink: 0 }}
                    >
                        Download Dimension Data
                    </CsvExportButton>
                </Box>
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                    <CircularProgress disableShrink color="primary" />
                </Box>
            ) : queryData.length > 0 ? (
                <>
                    <TableContainer component={Paper} sx={{ 
                        overflowX: 'auto',
                        '-webkit-overflow-scrolling': 'touch',
                        minWidth: 0
                    }}>
                        <Table
                            sx={{
                                minWidth: { xs: 800, md: 'auto' },
                                '& .MuiTableCell-root': { fontSize: "0.82rem !important" },
                                '& .MuiTableHead-root .MuiTableCell-root': { fontSize: "0.82rem !important", fontWeight: 'bold !important' },
                                '& .MuiTableSortLabel-root': { fontSize: "0.82rem !important" },
                            }}
                        >
                            <TableHead>
                                <TableRow>
                                    {columns.map(col => (
                                        <TableCell key={col.id}
                                            sortDirection={orderBy === col.id ? order : false}
                                            sx={{
                                                whiteSpace: 'nowrap',
                                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                                padding: { xs: '8px 6px', sm: '16px' },
                                                minWidth: col.id === 'Dept' ? 70 : col.id === 'CAT' ? 70 : 'auto'
                                            }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                                                {/* 先排序按钮，再filter按钮 */}
                                                {col.id !== 'FurtherAnalysis' ? (
                                                    <TableSortLabel
                                                        active={orderBy === col.id}
                                                        direction={orderBy === col.id ? (order === 'asc' ? 'desc' : 'asc') : 'asc'}
                                                        onClick={() => handleRequestSort(col.id)}
                                                    >
                                                        {col.label}
                                                    </TableSortLabel>
                                                ) : col.label}
                                                {col.id !== 'FurtherAnalysis' && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={e => handleFilterIconClick(e, col.id)}
                                                        sx={{ ml: 0.5 }}
                                                    >
                                                        <FilterListIcon fontSize="small" />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {finalFilteredData
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((row, index) => (
                                    <TableRow key={index}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => {
                                                    navigate('/lots-sample-distribution-table', {
                                                        state: {
                                                            Period: date,
                                                            row },
                                                    });
                                                    console.log('Navigating with state:', { Period: date, row });
                                                }}
                                    >
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{formatMonthYear(date)}</TableCell>
                                        <TableCell sx={{ minWidth: 70, fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.Dept}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.MachineId}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.MaterialDesc}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.DimensionDesc}</TableCell>
                                        <TableCell sx={{ minWidth: 70, fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.CAT}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>
                                            {row.CPK_NC_Percentage !== undefined && row.CPK_NC_Percentage !== null && !isNaN(row.CPK_NC_Percentage)
                                                ? Number(row.CPK_NC_Percentage).toFixed(0) + '%'
                                                : row.CPK_NC_Percentage}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                backgroundColor: parseFloat(row.CPK) < MAX_NC ? '#F54D41' : 'inherit',
                                                color: parseFloat(row.CPK) < MAX_NC ? 'white' : 'inherit',
                                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                                padding: { xs: '8px 6px', sm: '16px' }
                                            }}
                                        >
                                            {row.CPK !== undefined && row.CPK !== null && !isNaN(row.CPK)
                                                ? Number(row.CPK).toFixed(3)
                                                : formatMetric(row.CPK, row.NO_OF_DATA)}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                backgroundColor: parseFloat(row.PPK) < MAX_NC ? '#F54D41' : 'inherit',
                                                color: parseFloat(row.PPK) < MAX_NC ? 'white' : 'inherit',
                                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                                padding: { xs: '8px 6px', sm: '16px' }
                                            }}
                                        >
                                            {row.PPK !== undefined && row.PPK !== null && !isNaN(row.PPK)
                                                ? Number(row.PPK).toFixed(3)
                                                : formatMetric(row.PPK, row.NO_OF_DATA)}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                backgroundColor: parseFloat(row.CP) < MAX_NC ? '#F54D41' : 'inherit',
                                                color: parseFloat(row.CP) < MAX_NC ? 'white' : 'inherit',
                                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                                padding: { xs: '8px 6px', sm: '16px' }
                                            }}
                                        >
                                            {row.CP !== undefined && row.CP !== null && !isNaN(row.CP)
                                                ? Number(row.CP).toFixed(3)
                                                : formatMetric(row.CP, row.NO_OF_DATA)}
                                        </TableCell>
                                        <TableCell
                                        
                                            sx={{
                                                backgroundColor: parseFloat(row.PP) < MAX_NC ? '#F54D41' : 'inherit',
                                                color: parseFloat(row.PP) < MAX_NC ? 'white' : 'inherit',
                                                fontSize: { xs: '0.75rem', sm: '0.875rem' },
                                                padding: { xs: '8px 6px', sm: '16px' }
                                            }}
                                        >
                                            {row.PP !== undefined && row.PP !== null && !isNaN(row.PP)
                                                ? Number(row.PP).toFixed(3)
                                                : formatMetric(row.PP, row.NO_OF_DATA)}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.NO_OF_DATA}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.BatchMC2}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, padding: { xs: '8px 6px', sm: '16px' } }}>{row.BatchMC4}</TableCell>
                                        <TableCell sx={{ padding: { xs: '4px', sm: '8px' } }}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                <Button
                                                    startIcon={<AssessmentIcon />}
                                                    variant="contained"
                                                    color="primary"
                                                    sx={{ color: 'darkblue', fontSize: { xs: '0.6rem', sm: '0.75rem' }, padding: { xs: '4px', sm: '6px' }, textTransform: 'none' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // don't also fire the row's onClick (double history entry)
                                                        navigate('/lots-sample-distribution-table', {
                                                            state: {
                                                                Period: date,
                                                                row },
                                                        });
                                                    }}
                                                >
                                                    Analysis
                                                </Button>
                                                {/* BRD M3b: Historical Analysis -> default 6-month scattered distribution + raw data */}
                                                <Button
                                                    startIcon={<HistoryIcon />}
                                                    variant="outlined"
                                                    color="info"
                                                    sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' }, padding: { xs: '4px', sm: '6px' }, textTransform: 'none' }}
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // don't also fire the row's onClick (double history entry)
                                                        const s = String(date || '');
                                                        const mm = s.match(/^(\d{4})(\d{2})$/);
                                                        let dateRange;
                                                        if (mm) {
                                                            const end = new Date(Number(mm[1]), Number(mm[2]) - 1, 1);
                                                            const start = new Date(end.getFullYear(), end.getMonth() - 5, 1);
                                                            const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                            dateRange = [fmt(start), fmt(end)];
                                                        }
                                                        navigate('/subsample-scatter', { state: { selectedData: { ...row, dateRange } } });
                                                    }}
                                                >
                                                    Historical
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                ))}
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
            {/* Filtering Popover */}
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
                            {/* 3-decimal columns: flexible range, options selectable */}
                            {is3DecimalCol(filterColumn) ? (
                                <>
                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Range</Typography>
                                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                                        <TextField
                                            label="Min"
                                            size="small"
                                            variant="outlined"
                                            value={filterValues[filterColumn]?.min ?? ''}
                                            onChange={e => handleFilterChange(filterColumn, { ...filterValues[filterColumn], min: e.target.value })}
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
                                            onChange={e => handleFilterChange(filterColumn, { ...filterValues[filterColumn], max: e.target.value })}
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
                                                                // 2. Toggle逻辑：再次点击取消选择
                                                                const currentMin = filterValues[filterColumn]?.min;
                                                                const currentMax = filterValues[filterColumn]?.max;
                                                                if (currentMin === option && currentMax === option) {
                                                                    setFilterValues(prev => ({
                                                                        ...prev,
                                                                        [filterColumn]: { min: '', max: '' }
                                                                    }));
                                                                    setPage(0);
                                                                } else {
                                                                    setFilterValues(prev => ({
                                                                        ...prev,
                                                                        [filterColumn]: {
                                                                            min: option,
                                                                            max: option
                                                                        }
                                                                    }));
                                                                    setPage(0);
                                                                }
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
                                        onClick={() => setFilterValues(prev => ({ ...prev, [filterColumn]: { min: '', max: '' } }))}
                                    >
                                        Clear Selection
                                    </Box>
                                </>
                            ) : filterColumn === 'MaterialDesc' ? (
                                <>
                                    {/* BRD M2c: standard text search filter (was a 2-letter group selector). */}
                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Search Material Description</Typography>
                                    <TextField
                                        autoFocus
                                        fullWidth
                                        size="small"
                                        placeholder="Type to search…"
                                        value={typeof filterValues[filterColumn] === 'string' ? filterValues[filterColumn] : ''}
                                        onChange={(e) => handleFilterChange(filterColumn, e.target.value)}
                                    />
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
                            ) : filterColumn === 'BatchMC2' || filterColumn === 'BatchMC4' ? (
                                <>
                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Select Furnaces</Typography>
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
                                            const furnaces = getUniqueFurnaces(filterColumn);
                                            const selectedFurnaces = Array.isArray(filterValues[filterColumn]) 
                                                ? filterValues[filterColumn] 
                                                : [];
                                            return (
                                                <>
                                                    {furnaces.length === 0 && (
                                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, px: 2 }}>
                                                            No data
                                                        </Typography>
                                                    )}
                                                    {furnaces.map(furnace => (
                                                        <Box
                                                            key={furnace}
                                                            sx={{
                                                                cursor: 'pointer',
                                                                px: 2,
                                                                py: 1,
                                                                borderRadius: 1,
                                                                transition: 'background 0.15s',
                                                                background: selectedFurnaces.includes(furnace)
                                                                    ? '#1976d2'
                                                                    : undefined,
                                                                color: selectedFurnaces.includes(furnace)
                                                                    ? '#fff'
                                                                    : undefined,
                                                                fontWeight: selectedFurnaces.includes(furnace) ? 600 : undefined,
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
                                                                const current = Array.isArray(filterValues[filterColumn]) 
                                                                    ? filterValues[filterColumn] 
                                                                    : [];
                                                                const updated = current.includes(furnace)
                                                                    ? current.filter(f => f !== furnace)
                                                                    : [...current, furnace];
                                                                handleFilterChange(filterColumn, updated);
                                                            }}
                                                        >
                                                            {furnace}
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
                                        onClick={() => handleFilterChange(filterColumn, [])}
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
                                                                // 2. Toggle逻辑：再次点击取消选择
                                                                const currentVal = filterValues[filterColumn];
                                                                const newValue = currentVal === option ? '' : option;
                                                                handleFilterChange(filterColumn, newValue);
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
                            )
                            }
                        </>
                    )}
                </Box>
            </Popover>
            </Box>
        </Box>
    );
};

export default OverallLotsClickedTable;
