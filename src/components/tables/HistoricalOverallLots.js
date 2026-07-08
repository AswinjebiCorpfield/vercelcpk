import React, { useEffect, useRef, useState, useMemo } from 'react';
import useDrilldownNavigate from '../../utils/useDrilldownNavigate';
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TablePagination,
  Switch,
  Stack,
  TableSortLabel,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Divider,
  TextField,
  Tooltip,
  Slider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Chip,
  Badge
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import axios, { all } from 'axios';
import FilterManager from '../FilterManager';
import { useValue } from '../../context/ContextProvider';
import CsvExportButton from '../CsvExportButton';
import { months } from 'dayjs/locale/en';

function formatMonthCol(periodStr) {
  if (!periodStr) return '';
  // periodStr 现在是 "202509" 这种格式
  if (periodStr.length === 6) {
    const year = periodStr.slice(0, 4);
    const month = periodStr.slice(4, 6);
    const date = new Date(`${year}-${month}-01`);
    return date.toLocaleString('en-US', { month: 'short' }) + ' ' + year;
  }
  return periodStr;
}

const FILTER_KEYS = ['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'];

// Fixed widths for the leading text columns so they don't take up extra space
const TEXT_COL_WIDTHS = {
  Dept: 60,
  MachineId: 110,
  MaterialDesc: 150,
  DimensionDesc: 170,
  CAT: 55,
};


const normalizeMonth = (month) => {
  if (!month) return '';
  const str = `${month}`;
  if (/^\d{6}$/.test(str)) return str;
  if (/^\d{4}-\d{2}$/.test(str)) return str.replace('-', '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str.slice(0, 7).replace('-', '');
  return '';
};

const getMonthRange = (startMonth, endMonth) => {
  const start = normalizeMonth(startMonth);
  const end = normalizeMonth(endMonth);
  if (!start || !end) return [];

  let startYear = parseInt(start.slice(0, 4), 10);
  let startMon = parseInt(start.slice(4, 6), 10);
  let endYear = parseInt(end.slice(0, 4), 10);
  let endMon = parseInt(end.slice(4, 6), 10);

  if (
    Number.isNaN(startYear) || Number.isNaN(startMon) ||
    Number.isNaN(endYear) || Number.isNaN(endMon)
  ) {
    return [];
  }

  if (startYear > endYear || (startYear === endYear && startMon > endMon)) {
    [startYear, endYear] = [endYear, startYear];
    [startMon, endMon] = [endMon, startMon];
  }

  const monthsInRange = [];
  let y = startYear;
  let m = startMon;
  while (y < endYear || (y === endYear && m <= endMon)) {
    monthsInRange.push(`${y}${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return monthsInRange;
};

const MonthlyHistoricalOverallLots = () => {
  const { state } = useValue();
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isCPK, setIsCPK] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(500);
  const [orderBy, setOrderBy] = useState(undefined);
  const [order, setOrder] = useState('asc');
  // filters本地和context同步，Month统一为YYYY-MM
  // 月份列过滤相关（现由 filter bar 的 "Value Filter" 模态框驱动）
  const [monthRangeFilters, setMonthRangeFilters] = useState({}); // { '202509': { min: 0.99, max: 1.00, exactValue: null } }
  const [allRawMonths, setAllRawMonths] = useState([]);  // 不受月份筛选影响的完整月份列表

  // 全屏 (fullscreen) — 使用浏览器 Fullscreen API 将整个页面容器全屏显示
  const rootRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 表格字号 (table font size in px) — 由 toolbar 的 slider 控制；列宽随字号等比缩放，字号越小滚动越少
  const [tableFontSize, setTableFontSize] = useState(12);
  const fontScale = tableFontSize / 12;
  const scaleW = (n) => Math.round(n * fontScale);

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen)?.call(el);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen)?.call(document);
    }
  };

  useEffect(() => {
    const handleChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleChange);
    document.addEventListener('webkitfullscreenchange', handleChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleChange);
      document.removeEventListener('webkitfullscreenchange', handleChange);
    };
  }, []);


  const [filters, setFilters] = useState(() => {
    const f = state.filters || {};
    const hasSavedFilters = Object.keys(f).length > 0;
    return { 
      ...f,
      Dept: hasSavedFilters ? (f?.Dept ?? '') : 'HT',
      MachineId: hasSavedFilters ? (f?.MachineId ?? '') : 'HTFDCATE-L1',
      CAT: Array.isArray(f?.CAT) ? f.CAT : (f?.CAT ? [f.CAT] : ['CTQ', 'CTP', 'NOR']),
      StartMonth: normalizeMonth(f.StartMonth), 
      EndMonth: normalizeMonth(f.EndMonth) 
    };
  });

  // 独立获取所有可用月份（不传 StartMonth/EndMonth），确保月份下拉始终显示完整候选项
  useEffect(() => {
    const fetchAllMonths = async () => {
      try {
        const filterToSend = {
          Dept: filters.Dept || '',
          MachineId: filters.MachineId || '',
          MaterialDesc: filters.MaterialDesc || '',
          DimensionDesc: filters.DimensionDesc || '',
          CAT: filters.CAT,
          // 不传 StartMonth / EndMonth
        };
        const response = await axios.post(`${window.baseURL}/filter-options`, { filter: filterToSend });
        const monthSet = new Set([
          ...(response.data.StartMonth || []),
          ...(response.data.EndMonth || []),
        ]);
        setAllRawMonths(Array.from(monthSet).sort((a, b) => a.localeCompare(b)));
      } catch (e) {
        console.error('Error fetching all months:', e);
      }
    };
    fetchAllMonths();
  // eslint-disable-next-line
  }, [filters.Dept, filters.MachineId, filters.MaterialDesc, filters.DimensionDesc, filters.CAT]);

  // context filters变化时同步到本地filters，并格式化Month
  // Removed useEffect([state.filters]) — it was creating new filter object refs on every context change,
  // which caused FilterManager to re-render mid-interaction and disrupted MUI Autocomplete's internal state.

  // 当monthRangeFilters变化时重置页码
  useEffect(() => {
    setPage(0);
  }, [monthRangeFilters]);
  

  const drill = useDrilldownNavigate();
  // Track last fetched filter key to avoid redundant API calls when filter refs change but values are the same
  const lastFetchKeyRef = useRef(null);

  useEffect(() => {
    const fetchKey = JSON.stringify({ isCPK, ...filters });
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        // console.log('Fetching data...', state.filters, { isCPK });
        const response = await axios.get(`${window.baseURL}/overall-lots-cpk-ppk-summary-monthly`, {
          params: {
            isCpk: isCPK,
            dept: filters.Dept || '',
            machineId: filters.MachineId || '',
            materialDesc: filters.MaterialDesc || '',
            dimensionDesc: filters.DimensionDesc || '',
            startMonth: filters.StartMonth || '',
            endMonth: filters.EndMonth || '',
            cat: Array.isArray(filters.CAT) ? filters.CAT : (filters.CAT ? [filters.CAT] : [])
          }
        });
        // console.log('Fetched data:', response.data);
        if (response.status === 200) {
          // console.log('【DEBUG】First data row keys:', response.data.length > 0 ? Object.keys(response.data[0]) : 'empty');
          // console.log('【DEBUG】First data row sample:', response.data.length > 0 ? response.data[0] : 'empty');
          setData(response.data);
          // 自动apply context filters
          let filtered = response.data;
          FILTER_KEYS.forEach(key => {
            if (filters[key]) {
              filtered = filtered.filter(row => row[key] === filters[key]);
            }
          });
          setFilteredData(filtered);
          // console.log('Filtered data:', filtered);
        } else {
          throw new Error(`Request failed with status code ${response.status}`);
        }
      } catch (err) {
        setError(err.message);
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line
  }, [isCPK, filters]);

  // 新增：filters 或 data 变化时自动过滤
  // useEffect(() => {
  //   let filtered = data;
  //   FILTER_KEYS.forEach(key => {
  //     if (filters[key]) {
  //       filtered = filtered.filter(row => row[key] === filters[key]);
  //     }
  //   });
  //   setFilteredData(filtered);
  // }, [filters, data]);

  // 排序方法
  const handleRequestSort = (event, property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // 清除所有月份的过滤
  const handleClearAllFilters = () => {
    setMonthRangeFilters({});
    setModalStartMonth('');
    setModalEndMonth('');
    setModalMin('');
    setModalMax('');
  };

  // ===== Filter-bar month/value modal =====
  // A single control in the filter bar that opens a modal to pick a month
  // (year + month) and set a min/max range — writes to the same monthRangeFilters
  // that the per-column funnel uses, so the table reacts identically.
  const [monthValueModalOpen, setMonthValueModalOpen] = useState(false);
  const [modalStartMonth, setModalStartMonth] = useState('');
  const [modalEndMonth, setModalEndMonth] = useState('');
  const [modalMin, setModalMin] = useState('');
  const [modalMax, setModalMax] = useState('');

  const resetMonthValueModalFields = () => {
    setModalStartMonth('');
    setModalEndMonth('');
    setModalMin('');
    setModalMax('');
  };
  const openMonthValueModal = () => setMonthValueModalOpen(true);
  const closeMonthValueModal = () => {
    setMonthValueModalOpen(false);
    resetMonthValueModalFields();
  };

  // Clicking an active-filter chip prefills the range (single month) and its min/max.
  const handleModalMonthChange = (month) => {
    setModalStartMonth(month || '');
    setModalEndMonth(month || '');
    const existing = month ? monthRangeFilters[month] : null;
    setModalMin(existing?.min ?? '');
    setModalMax(existing?.max ?? '');
  };

  // Apply the min/max to every month column between Start and End (inclusive).
  const handleApplyMonthValueFilter = () => {
    const start = modalStartMonth || modalEndMonth;
    const end = modalEndMonth || modalStartMonth;
    if (!start && !end) return;
    const lo = start <= end ? start : end;
    const hi = start <= end ? end : start;
    const monthsInRange = monthHeaderKeys.filter(m => m >= lo && m <= hi);
    if (monthsInRange.length === 0) return;
    const noMin = modalMin === '' || modalMin === null || modalMin === undefined;
    const noMax = modalMax === '' || modalMax === null || modalMax === undefined;
    setMonthRangeFilters(prev => {
      const next = { ...prev };
      monthsInRange.forEach(m => {
        if (noMin && noMax) {
          delete next[m]; // nothing set → clear these months
        } else {
          next[m] = { min: modalMin, max: modalMax, exactValue: null };
        }
      });
      return next;
    });
  };

  const handleRemoveMonthValueFilter = (month) => {
    setMonthRangeFilters(prev => {
      const next = { ...prev };
      delete next[month];
      return next;
    });
    if (month === modalStartMonth || month === modalEndMonth) { setModalMin(''); setModalMax(''); }
  };

  // 检查值是否在范围内（不包括dash）
  const isValueInRange = (monthCol, value) => {
    const numVal = parseFloat(value);
    // "-" 等不是数字的值，直接排除（不显示）
    if (!isFinite(numVal)) return false;
    
    const filter = monthRangeFilters[monthCol];
    if (!filter || (filter.min === '' && filter.max === '')) return true; // 没有range过滤，显示所有数值
    
    const minNum = filter.min !== '' ? parseFloat(filter.min) : -Infinity;
    const maxNum = filter.max !== '' ? parseFloat(filter.max) : Infinity;
    
    return numVal >= minNum && numVal <= maxNum;
  };

  // 新增：默认只显示近12个月（含本月） -- 
  const getRecent12Months = () => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      months.push(`${y}${m}`);
    }
    return months;
  };

  // 新增：所有可选月份（用于Start Month & End Month下拉）
  // 关键改动：基于 data，仅应用非月份filters（Dept, MachineId等），不应用StartMonth/EndMonth
  // 这样当清除StartMonth/EndMonth时，options会立即完整更新
  const allMonthOptions = useMemo(() => {
    const monthSet = new Set();
    
    // 只应用非月份的filters，基于 data（原始数据）
    let baseFiltered = data;
    FILTER_KEYS.forEach(key => {
      if (key === 'CAT' && Array.isArray(filters[key]) && filters[key].length > 0) {
        baseFiltered = baseFiltered.filter(row => filters[key].includes(row[key]));
      } else if (key !== 'CAT' && filters[key]) {
        baseFiltered = baseFiltered.filter(row => row[key] === filters[key]);
      }
    });
    
    // 从只应用非月份filters的数据中提取所有月份
    baseFiltered.forEach(row => {
      Object.keys(row).forEach(k => {
        if (/^\d{6}$/.test(k)) {
          const value = row[k];
          // 如果值不是空/null/"-"，则认为这个月份有真实数据
          if (value !== null && value !== undefined && value !== '' && value !== ' - ') {
            monthSet.add(k);
          }
        }
      });
    });
    
    const result = Array.from(monthSet).sort((a, b) => a.localeCompare(b));
    return result;
  }, [data, filters.Dept, filters.MachineId, filters.MaterialDesc, filters.DimensionDesc, filters.CAT]);

  
  // 所有表头
  const tableHeaders = useMemo(() => {
    const baseHeaders = FILTER_KEYS;
    let monthHeaders;

    // Keep header generation consistent with what Start/End Month inputs are showing.
    // If filters are empty, the UI still shows defaults (recent 12 months), so we use the same effective range here.
    const recent12 = getRecent12Months();
    const defaultStart = recent12[0] || '';
    const defaultEnd = recent12[recent12.length - 1] || '';
    const effectiveStart = filters.StartMonth || defaultStart;
    const effectiveEnd = filters.EndMonth || defaultEnd;

    if (effectiveStart && effectiveEnd) {
      monthHeaders = getMonthRange(effectiveStart, effectiveEnd);
    } else {
      monthHeaders = [];
    }

    return [...baseHeaders, ...monthHeaders, 'Analysis'];
  }, [filters.StartMonth, filters.EndMonth]);

  // Visible month columns (6-digit keys) — the options for the month/value modal.
  const monthHeaderKeys = useMemo(
    () => tableHeaders.filter((h) => /^\d{6}$/.test(h)),
    [tableHeaders]
  );

  // Active per-month value filters (min/max set) — drives the badge + chips.
  const activeMonthValueFilters = useMemo(
    () => Object.entries(monthRangeFilters).filter(([, f]) =>
      f && ((f.min !== '' && f.min != null) || (f.max !== '' && f.max != null) || (f.exactValue != null))
    ),
    [monthRangeFilters]
  );

  // Ensure every row contains every visible month column.
  // Missing month values are normalized to "-" for stable rendering/export/filtering.
  const filledFilteredData = useMemo(() => {
    const monthHeaders = tableHeaders.filter((header) => /^\d{6}$/.test(header));

    return filteredData.map((row) => {
      const nextRow = { ...row };
      monthHeaders.forEach((month) => {
        const value = nextRow[month];
        if (value === undefined || value === null || value === '') {
          nextRow[month] = '-';
        }
      });
      return nextRow;
    });
  }, [filteredData, tableHeaders]);


  // 排序后数据
  const sortedFilteredData = useMemo(() => {
    if (!orderBy) {
      // 没有手动排序时：
      // 1) 先按 ranking（NC 数量）排序，多的排前面
      // 2) NC 相同时，按有值的月份 cell 数量排序，多的排前面
      return [...filledFilteredData].sort((a, b) => {
        let ncCountA = 0;
        let ncCountB = 0;
        let valueCountA = 0;
        let valueCountB = 0;
        tableHeaders.forEach(col => {
          if (/^\d{6}$/.test(col)) {  // 只看月份列
            const valueA = a[col];
            const numValueA = parseFloat(valueA);
            const hasValueA = valueA !== null && valueA !== undefined && valueA !== '' && valueA !== '-' && valueA !== ' - ';
            if (hasValueA) {
              valueCountA++;
            }
            if (typeof numValueA === 'number' && isFinite(numValueA) && numValueA < 0.9949) {
              ncCountA++;
            }
            const valueB = b[col];
            const numValueB = parseFloat(valueB);
            const hasValueB = valueB !== null && valueB !== undefined && valueB !== '' && valueB !== '-' && valueB !== ' - ';
            if (hasValueB) {
              valueCountB++;
            }
            if (typeof numValueB === 'number' && isFinite(numValueB) && numValueB < 0.9949) {
              ncCountB++;
            }
          }
        });
        if (ncCountB !== ncCountA) {
          return ncCountB - ncCountA; // 降序，NC 多的排前面
        }
        return valueCountB - valueCountA; // 降序，有值 cell 多的排前面
      });
    }
    // 有手动排序时，按指定列排序，覆盖默认 ranking
    return [...filledFilteredData].sort((a, b) => {
      let aValue = a[orderBy];
      let bValue = b[orderBy];
      if (orderBy === undefined) return 0;
      
      // 对于月份列，按数值排序，忽略 "-"
      if (/^\d{6}$/.test(orderBy)) {
        const aNum = parseFloat(aValue);
        const bNum = parseFloat(bValue);
        // 如果两个都是有效的数字，按数值排序
        if (typeof aNum === 'number' && isFinite(aNum) && typeof bNum === 'number' && isFinite(bNum)) {
          return order === 'asc' ? aNum - bNum : bNum - aNum;
        }
        // 如果其中一个是 "-"，将其放在后面
        if (aValue === ' - ' || aValue === '-' || !isFinite(aNum)) return 1;
        if (bValue === ' - ' || bValue === '-' || !isFinite(bNum)) return -1;
      }
      
      // 对于其他字段，尝试按数值排序，如果不是数字就按字符串排序
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return order === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // 字符串比较
      if (aValue < bValue) return order === 'asc' ? -1 : 1;
      if (aValue > bValue) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filledFilteredData, orderBy, order, tableHeaders]);

  // 根据 monthRangeFilters 进一步过滤表格行
  const displayedData = useMemo(() => {
    if (Object.keys(monthRangeFilters).length === 0) {
      return sortedFilteredData; // 没有范围过滤，显示所有
    }
    
    return sortedFilteredData.filter(row => {
      // 对于每一行，检查是否所有月份范围都符合
      for (const [monthCol, filter] of Object.entries(monthRangeFilters)) {
        // 如果设置了exactValue，则必须精确匹配
        if (filter.exactValue !== null && filter.exactValue !== undefined) {
          const value = row[monthCol];
          const numVal = parseFloat(value);
          const exactNum = parseFloat(filter.exactValue);
          
          // 精确匹配检查
          if (!isFinite(numVal) && filter.exactValue !== '-') {
            return false; // 选的是数字但row的值不是数字，不显示
          }
          if (isFinite(numVal) && !isFinite(exactNum)) {
            return false; // 选的是"-"但row的值是数字，不显示
          }
          if (isFinite(numVal) && isFinite(exactNum)) {
            if (Math.abs(numVal - exactNum) > 0.00001) {
              return false; // 数字不匹配
            }
          }
          continue; // exactValue符合，继续检查其他月份
        }
        
        // 如果设置了min或max（range过滤），则检查范围
        if (filter.min !== '' || filter.max !== '') {
          const value = row[monthCol];
          if (!isValueInRange(monthCol, value)) {
            return false; // 该行在该月份列不符合范围，隐藏该行
          }
        }
      }
      return true; // 该行所有月份都符合过滤条件，显示
    });
  }, [sortedFilteredData, monthRangeFilters]);

  const handleRowClick = (row) => {
    const selectedData = {};
    FILTER_KEYS.forEach(key => selectedData[key] = row[key]);
    // console.log(allMonthOptions);
    if (!filters.StartMonth && !filters.EndMonth) {
      const startMonth = allMonthOptions[allMonthOptions.length - 12];
      const endMonth = allMonthOptions[allMonthOptions.length - 1];
      selectedData.dateRange = [startMonth, endMonth];
    } 
    else if (!filters.StartMonth && filters.EndMonth) {
      const endMonth = filters.EndMonth;
      const startMonth = allMonthOptions[0];
      selectedData.dateRange = [startMonth, endMonth];
    }
    else if (filters.StartMonth && !filters.EndMonth) {
      const startMonth = filters.StartMonth;
      const endMonth = allMonthOptions[allMonthOptions.length - 1];
      selectedData.dateRange = [startMonth, endMonth];
    }
    else {
      const startMonth = filters.StartMonth;
      const endMonth = filters.EndMonth;
      selectedData.dateRange = [startMonth, endMonth];
    }
    // console.log("dateRange:", selectedData.dateRange);
    // console.log('Selected row for analysis:', selectedData);
    drill('subsample-scatter', { state: { selectedData } });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // (allMonthOptions moved above tableHeaders to avoid temporal dead zone)



  if (error) {
    return (
      <Box sx={{ ml: 10, marginTop: 20 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={rootRef}
      sx={{
        px: 1.5,
        mt: 2,
        ...(isFullscreen && {
          bgcolor: 'background.default',
          height: '100vh',
          overflowY: 'auto',
          pt: 2,
        }),
      }}
    >
      {!isFullscreen && (
      <FilterManager
        data={data}
        filters={filters}
        setFilters={setFilters}
        onFilterUpdate={setFilteredData}
        monthOptions={allRawMonths}
        bottomRow={
          <>
            <Tooltip title="Filter cell values by month (min / max)">
              <Badge badgeContent={activeMonthValueFilters.length} color="primary">
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<FilterAltIcon fontSize="small" />}
                  onClick={openMonthValueModal}
                  sx={{
                    textTransform: 'none', whiteSpace: 'nowrap', height: 36,
                    borderColor: activeMonthValueFilters.length ? 'primary.main' : 'divider',
                    color: activeMonthValueFilters.length ? 'primary.main' : 'text.secondary',
                  }}
                >
                  Value Filter
                </Button>
              </Badge>
            </Tooltip>
            <Tooltip title="Download data (CSV)">
              <span>
                <CsvExportButton
                  data={filledFilteredData}
                  // Export omits the "Analysis" column (UI-only drill-in buttons) and the
                  // MachineId / MaterialDesc / DimensionDesc / CAT identity columns (per request).
                  headers={tableHeaders.filter(h => !['Analysis', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'].includes(h))}
                  generalInfo={[
                    { label: 'Report', value: 'Historical Monthly Measurement Table' },
                    { label: 'Period', value: [filters.StartMonth, filters.EndMonth].filter(Boolean).join(' – ') },
                    { label: 'Dept', value: filters.Dept || '' },
                  ]}
                  filename={(() => {
                    const range = [filters.StartMonth, filters.EndMonth].filter(Boolean).map(formatMonthCol).join(' – ');
                    return `Historical Dimension Measurement Table${range ? '_' + range : ''}.csv`;
                  })()}
                  sx={{ px: 1.5, height: 36, textTransform: 'none', whiteSpace: 'nowrap', color: 'text.secondary', borderColor: 'divider' }}
                >
                  <DownloadIcon fontSize="small" style={{ marginRight: 6 }} />
                  Export
                </CsvExportButton>
              </span>
            </Tooltip>
            <Tooltip title="Full screen">
              <Button
                onClick={toggleFullscreen}
                variant="outlined"
                size="small"
                startIcon={<FullscreenIcon fontSize="small" />}
                sx={{ height: 36, textTransform: 'none', whiteSpace: 'nowrap', color: 'text.secondary', borderColor: 'divider' }}
              >
                Full Screen
              </Button>
            </Tooltip>
            <Tooltip title="Adjust table font size">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1, minWidth: 180 }}>
                <FormatSizeIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                <Slider
                  value={tableFontSize}
                  min={8}
                  max={18}
                  step={1}
                  size="small"
                  valueLabelDisplay="auto"
                  onChange={(_, v) => setTableFontSize(v)}
                  sx={{ width: 120 }}
                />
                <Typography sx={{ fontSize: 12, color: 'text.secondary', width: 34, textAlign: 'right' }}>
                  {tableFontSize}px
                </Typography>
              </Box>
            </Tooltip>
            <TablePagination
              rowsPerPageOptions={[100, 500, 1000]}
              component="div"
              count={sortedFilteredData.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              sx={{ ml: 'auto' }}
            />
          </>
        }
        leading={
          <>
            <Box sx={{ display: 'inline-flex', p: '3px', borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', flexShrink: 0, alignSelf: 'center' }}>
              {[{ label: 'CPK', val: true }, { label: 'PPK', val: false }].map((o) => (
                <Box
                  key={o.label}
                  onClick={() => setIsCPK(o.val)}
                  sx={{
                    px: 2, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5,
                    bgcolor: isCPK === o.val ? 'primary.main' : 'transparent',
                    color: isCPK === o.val ? '#fff' : 'text.secondary',
                    transition: 'all .15s',
                  }}
                >
                  {o.label}
                </Box>
              ))}
            </Box>
          </>
        }
      />
      )}

      {/* Month / value filter modal (opened from the "Value Filter" button in the filter bar) */}
      <Dialog open={monthValueModalOpen} onClose={closeMonthValueModal} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Filter Values by Month</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Select a start and end month, then set a minimum and/or maximum. Only cells within that
            month range whose value falls within the range are kept; others are hidden.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Autocomplete
              fullWidth
              options={monthHeaderKeys.filter(m => !modalEndMonth || m <= modalEndMonth)}
              value={modalStartMonth || null}
              onChange={(e, v) => setModalStartMonth(v || '')}
              getOptionLabel={(o) => formatMonthCol(o)}
              isOptionEqualToValue={(o, v) => o === v}
              renderInput={(params) => <TextField {...params} label="Start Month" size="small" />}
              ListboxProps={{ style: { maxHeight: 260 } }}
            />
            <Autocomplete
              fullWidth
              options={monthHeaderKeys.filter(m => !modalStartMonth || m >= modalStartMonth)}
              value={modalEndMonth || null}
              onChange={(e, v) => setModalEndMonth(v || '')}
              getOptionLabel={(o) => formatMonthCol(o)}
              isOptionEqualToValue={(o, v) => o === v}
              renderInput={(params) => <TextField {...params} label="End Month" size="small" />}
              ListboxProps={{ style: { maxHeight: 260 } }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Min" type="number" size="small" fullWidth
              value={modalMin} onChange={(e) => setModalMin(e.target.value)}
              inputProps={{ step: '0.0001' }} disabled={!modalStartMonth && !modalEndMonth}
            />
            <TextField
              label="Max" type="number" size="small" fullWidth
              value={modalMax} onChange={(e) => setModalMax(e.target.value)}
              inputProps={{ step: '0.0001' }} disabled={!modalStartMonth && !modalEndMonth}
            />
          </Box>

          {activeMonthValueFilters.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                Active month filters
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {activeMonthValueFilters.map(([month, f]) => {
                  const parts = [];
                  if (f.min !== '' && f.min != null) parts.push(`≥ ${f.min}`);
                  if (f.max !== '' && f.max != null) parts.push(`≤ ${f.max}`);
                  return (
                    <Chip
                      key={month}
                      size="small"
                      label={`${formatMonthCol(month)}: ${parts.join(', ')}`}
                      onClick={() => handleModalMonthChange(month)}
                      onDelete={() => handleRemoveMonthValueFilter(month)}
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={handleClearAllFilters}
            color="inherit"
            disabled={activeMonthValueFilters.length === 0}
          >
            Clear All
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={closeMonthValueModal} color="inherit">Close</Button>
          <Button variant="contained" onClick={handleApplyMonthValueFilter} disabled={!modalStartMonth && !modalEndMonth}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress disableShrink color="primary" sx={{ height: '100vh' }} />
        </Box>
      ) : (
        <>
          {isFullscreen && (
            <Tooltip title="Exit full screen">
              <IconButton
                onClick={toggleFullscreen}
                size="small"
                sx={{
                  position: 'fixed',
                  top: 8,
                  right: 12,
                  zIndex: 1300,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <FullscreenExitIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <TableContainer
            component={Paper}
            sx={{
              overflowX: 'auto',
              '&::-webkit-scrollbar': { height: 10 },
              '&::-webkit-scrollbar-track': {
                bgcolor: 'action.hover',
                borderRadius: 5,
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: 'primary.main',
                borderRadius: 5,
                border: '2px solid transparent',
                backgroundClip: 'content-box',
              },
              '&::-webkit-scrollbar-thumb:hover': { bgcolor: 'primary.dark' },
              // Firefox
              scrollbarWidth: 'thin',
              scrollbarColor: (theme) => `${theme.palette.primary.main} ${theme.palette.action.hover}`,
            }}
          >
            <Table
              size="small"
              stickyHeader
              sx={{
                '& .MuiTableCell-root': {
                  fontSize: `${tableFontSize}px`,
                  py: 0.1,
                  lineHeight: 1.15,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {tableHeaders.map((header, idx) => {
                    let displayName = header;
                    const isMonthCol = /^\d{6}$/.test(header);
                    if (isMonthCol) {
                      displayName = formatMonthCol(header);
                      // In full screen, compact "Sep 2025" → "Sep 25" so the 78px column keeps the filter icon
                      if (isFullscreen) displayName = displayName.replace(/\s(\d{2})(\d{2})$/, ' $2');
                    }

                    return (
                      <TableCell
                        key={header}
                        sx={{
                          position: 'relative',
                          ...(isMonthCol && { width: scaleW(isFullscreen ? 62 : 96), minWidth: scaleW(isFullscreen ? 62 : 96), maxWidth: scaleW(isFullscreen ? 62 : 96), px: isFullscreen ? 0.25 : 0.5 }),
                          ...(header === 'Analysis' && { width: scaleW(82), minWidth: scaleW(82), maxWidth: scaleW(82), px: 0.5, whiteSpace: 'nowrap' }),
                          ...(TEXT_COL_WIDTHS[header] && {
                            width: scaleW(TEXT_COL_WIDTHS[header]),
                            minWidth: scaleW(TEXT_COL_WIDTHS[header]),
                            maxWidth: scaleW(TEXT_COL_WIDTHS[header]),
                            px: 1,
                          }),
                        }}
                      >
                        <Box sx={{
                          display: 'flex',
                          alignItems: 'center',
                          flexDirection: 'row',
                          flexWrap: 'nowrap',
                          lineHeight: 1,
                          // 月份列：名字与过滤图标同一行，图标靠右
                          justifyContent: isMonthCol ? 'space-between' : (header === 'Analysis' ? 'center' : 'flex-start'),
                          gap: isMonthCol ? 0.25 : (header === 'Analysis' ? 0 : 1),
                        }}>
                          {header === 'Analysis' ? (
                            <span style={{ whiteSpace: 'nowrap' }}>{displayName}</span>
                          ) : (
                            <TableSortLabel
                              active={orderBy === header}
                              direction={orderBy === header ? order : 'asc'}
                              onClick={(e) => handleRequestSort(e, header)}
                              sx={isMonthCol ? { whiteSpace: 'nowrap', lineHeight: 1 } : undefined}
                            >
                              {displayName}
                            </TableSortLabel>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayedData
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, index) => (
                    <TableRow
                      key={index}
                      // 移除hover属性，改为cell hover
                      sx={{}}
                    >
                      {tableHeaders.map((col, colIndex) => {
                        const value = row[col];
                        const isMonthCol = /^\d{6}$/.test(col);
                        // Analysis列
                        if (col === 'Analysis') {
                          return (
                            <TableCell key={colIndex} align="center" sx={{ width: scaleW(82), minWidth: scaleW(82), maxWidth: scaleW(82), px: 0.5 }}>
                              <Button
                                startIcon={<AssessmentIcon />}
                                variant="contained"
                                color="primary"
                                size="small"
                                sx={{
                                  color: 'darkblue',
                                  width: 44,
                                  minWidth: 44,
                                  py: 0.1,
                                  minHeight: 22,
                                  '& .MuiButton-startIcon': { mr: 0 },
                                }}
                                onClick={() => handleRowClick(row)}
                              >
                              </Button>
                            </TableCell>
                          );
                        }
                        // 月份cell点击跳转，且不是'-'
                        if (isMonthCol) {
                          const isDash = value === ' - ' || value === '-' || value === undefined || value === null || value === '';
                          const displayValue = isDash ? '-' : value;

                          return (
                            <TableCell
                              key={colIndex}
                              sx={{
                                width: scaleW(isFullscreen ? 62 : 96),
                                minWidth: scaleW(isFullscreen ? 62 : 96),
                                maxWidth: scaleW(isFullscreen ? 62 : 96),
                                px: isFullscreen ? 0.25 : 0.5,
                                cursor: isDash ? 'not-allowed' : 'pointer',
                                color: isDash ? 'grey' : undefined,
                                backgroundColor: !isDash && Number(value) < 0.9949 ? '#F54D41' : undefined, // 不在范围内的cell背景变红
                              }}
                              onClick={isDash ? undefined : () => {
                                const recent12 = getRecent12Months();
                                drill('lots-sample-distribution-table', {
                                  state: {
                                    Period: col,
                                    // Effective historical range (matches the visible month columns) →
                                    // shown as the Period label on the drill-in.
                                    periodStart: filters.StartMonth || recent12[0],
                                    periodEnd: filters.EndMonth || recent12[recent12.length - 1],
                                    stats: value,
                                    row: row,
                                  },
                                });
                              }}
                            >
                              {displayValue}
                            </TableCell>
                          );
                        }

                        // 其它cell正常渲染
                        return (
                          <TableCell
                            key={colIndex}
                            sx={TEXT_COL_WIDTHS[col] ? {
                              width: scaleW(TEXT_COL_WIDTHS[col]),
                              minWidth: scaleW(TEXT_COL_WIDTHS[col]),
                              maxWidth: scaleW(TEXT_COL_WIDTHS[col]),
                              px: 1,
                            } : undefined}
                          >
                            {value}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[100, 500, 1000]}
            component="div"
            count={displayedData.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}

          />
        </>
      )}
    </Box>
  );
};

export default MonthlyHistoricalOverallLots;