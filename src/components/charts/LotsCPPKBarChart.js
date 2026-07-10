import React, { useEffect, useState, useMemo, useContext } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Box, Stack, Typography, Switch, TextField, MenuItem, Button, Grid, Card, CardContent, CircularProgress, Autocomplete, IconButton, Tooltip } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import KpiTile, { KPI } from './KpiTile';
import axios from 'axios';
import useDrilldownNavigate from '../../utils/useDrilldownNavigate';
import './NCLotRankBar.css';
import { useValue } from '../../context/ContextProvider'; // 路径按你的项目结构调整
import { TimeSeriesContext } from '../../context/TimeSeriesContext';
import dayjs from 'dayjs';
import StackTotalLabels from './StackTotalLabels';


const FILTER_KEYS = ['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'];

const LotsCPPKBarChart = () => {
  // State for data and filters
    const { state, dispatch } = useValue();
  const { isTimeSeries } = useContext(TimeSeriesContext); // 从context读取时间序列标志
  const [dataList, setDataList] = useState([]);
  const [displayMode, setDisplayMode] = useState('Count');
  const [clickedDot, setClickDot] = useState(null);
  const [filters, setFilters] = useState(() => {
    // 初始化默认值（仅在没有任何历史筛选记录时生效）
    const defaultFilters = {
      Dept: 'HT',
      MachineId: 'HTFDCATE-L1',
      MaterialDesc: '',
      DimensionDesc: '',
      CAT: ['CTQ', 'CTP', 'NOR'],
      StartMonth: '',
      EndMonth: '',
    };
    
    // 优先从 state.filters 中继承（与全局 context 保持一致）
    const savedFilters = state?.filters;
    if (savedFilters && Object.keys(savedFilters).length > 0) {
      const hasSavedFilters = true;
      return {
        Dept: hasSavedFilters ? (savedFilters.Dept ?? '') : defaultFilters.Dept,
        MachineId: hasSavedFilters ? (savedFilters.MachineId ?? '') : defaultFilters.MachineId,
        MaterialDesc: savedFilters.MaterialDesc ?? defaultFilters.MaterialDesc,
        DimensionDesc: savedFilters.DimensionDesc ?? defaultFilters.DimensionDesc,
        // BRD S3: default CAT is multi-select CTQ/CTP/NOR; an empty array falls back to it too.
        CAT: Array.isArray(savedFilters.CAT)
          ? (savedFilters.CAT.length ? savedFilters.CAT : defaultFilters.CAT)
          : (savedFilters.CAT ? [savedFilters.CAT] : defaultFilters.CAT),
        StartMonth: savedFilters.StartMonth ?? defaultFilters.StartMonth,
        EndMonth: savedFilters.EndMonth ?? defaultFilters.EndMonth,
      };
    }
    
    return defaultFilters;
  });
  const drill = useDrilldownNavigate();
  const [allOptions, setAllOptions] = useState({
    Dept: [],
    MachineId: [],
    MaterialDesc: [],
    DimensionDesc: [],
    CAT: [],
    StartMonth: [],
    EndMonth: [],
  });
  const [loading, setLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [resultType, setResultType] = useState('ac');
  const [filterOpen, setFilterOpen] = useState(true); // BRD S1/G4: retractable filter panel

  // Fetch data based on filters and display mode
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 将所有参数改为小写，与后端期望保持一致
        const params = { 
          displayMode,
          dept: filters.Dept,
          machineId: filters.MachineId,
          materialDesc: filters.MaterialDesc,
          dimensionDesc: filters.DimensionDesc,
          cat: filters.CAT,  // ← 改为小写 cat，可以是数组
          startMonth: filters.StartMonth,
          endMonth: filters.EndMonth,
        };
        console.log('【DEBUG】 fetchData params object:', params);
        console.log('【DEBUG】 filters.CAT:', filters.CAT, 'Type:', typeof filters.CAT, 'IsArray:', Array.isArray(filters.CAT));
        
        const response = await axios.get(`${window.baseURL}/overall-lots-cpk-ppk-summary-ac-nc`, { 
          params,
          paramsSerializer: (params) => {
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
          }
        });
        console.log('Fetched data:', response.data);
        setDataList(response.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters, displayMode]);

  // Fetch available filter options
  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    const fetchFilterOptions = async () => {
      try {
        // console.log('POST /filter-options with filter:', filters);
        const filterToSend = { ...filters };
        delete filterToSend.CAT;  // 不发送CAT到filter-options
        // 不传月份给filter-options，保证月份候选项永远来自完整数据集
        delete filterToSend.StartMonth;
        delete filterToSend.EndMonth;
        const response = await axios.post(`${window.baseURL}/filter-options`, { filter: filterToSend });
        // 兼容后端返回小写key的情况，强制转为大写key
        const opt = response.data || {};
        setAllOptions({
          Dept: opt.Dept || [],
          MachineId: opt.MachineId || [],
          MaterialDesc: opt.MaterialDesc || [],
          DimensionDesc: opt.DimensionDesc || [],
          CAT: opt.CAT || [],
          StartMonth: opt.StartMonth || opt.startMonth || [],
          EndMonth: opt.EndMonth || opt.endMonth || [],
        });
      } catch (error) {
        if (!cancelled) setAllOptions({});
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    fetchFilterOptions();
    return () => { cancelled = true; };
  }, [filters]);

  
useEffect(() => {
  dispatch({ type: 'UPDATE_FILTERS', payload: filters });
  console.log('Filters updated in context:', filters);
}, [filters, dispatch]);


  // Filter change
  const handleFilterChange = (key, value) => {
    setFilters(prevFilters => {
      let updatedValue = value;
      
      // CAT多选处理
      if (key === 'CAT') {
        updatedValue = Array.isArray(value) ? value.filter(v => v && v.trim() !== '') : [];
      }

      const updatedFilters = { ...prevFilters, [key]: updatedValue };
      console.log('Updated filters:', updatedFilters);
      return updatedFilters;
    });
  };

  // Clear all filters
  const handleClearFilters = () => {
    const cleared = {
      Dept: '',
      MachineId: '',
      MaterialDesc: '',
      DimensionDesc: '',
      CAT: ['CTQ', 'CTP', 'NOR'], // BRD S3: reset to the default CAT selection, not empty
      StartMonth: '',
      EndMonth: '',
    };
    setFilters(cleared);
    dispatch({ type: 'UPDATE_FILTERS', payload: cleared });
  };

  const allMonthsCombined = React.useMemo(() => {
    return Array.from(new Set([
      ...(allOptions.StartMonth || []),
      ...(allOptions.EndMonth || []),
    ])).sort((a, b) => a.localeCompare(b));
  }, [allOptions]);

  const startMonthOptions = React.useMemo(() => {
    if (!filters.EndMonth) return allMonthsCombined;
    return allMonthsCombined.filter(m => m <= filters.EndMonth);
  }, [allMonthsCombined, filters.EndMonth]);

  const endMonthOptions = React.useMemo(() => {
    if (!filters.StartMonth) return allMonthsCombined;
    return allMonthsCombined.filter(m => m >= filters.StartMonth);
  }, [allMonthsCombined, filters.StartMonth]);

  // Chart data processing
  const processData = () => {
    if (dataList.length === 0) {
      return [
        { acData: [], ncData: [], xLabels: [], title: 'Dimension', subtitle: 'Monthly CPK -ForTesting', averagePercent: 0, totalAC: 0, totalNC: 0 },
        { acData: [], ncData: [], xLabels: [], title: 'Dimension', subtitle: 'Monthly PPK', averagePercent: 0, totalAC: 0, totalNC: 0 },
      ];
    }
    const toOneDecimal = (val) => {
      const num = Number(val ?? 0);
      return Number.isFinite(num) ? Number(num.toFixed(1)) : 0;
    };
    const cpkDatasets = { acData: [], ncData: [], xLabels: [], countTotals: [] };
    const ppkDatasets = { acData: [], ncData: [], xLabels: [], countTotals: [] };
    let totalAC_CPK = 0, totalNC_CPK = 0, totalAC_PPK = 0, totalNC_PPK = 0;

    dataList.forEach(item => {
      // 用Period字段，格式如202509
      const date = item.Period && item.Period.length === 6
        ? `${item.Period.slice(0, 4)}-${item.Period.slice(4, 6)}`
        : item.Period || '';
      if (displayMode === 'Percent') {
        cpkDatasets.acData.push(toOneDecimal(item.CPK_AC_Percent));
        cpkDatasets.ncData.push(toOneDecimal(item.CPK_NC_Percent));
        ppkDatasets.acData.push(toOneDecimal(item.PPK_AC_Percent));
        ppkDatasets.ncData.push(toOneDecimal(item.PPK_NC_Percent));
      } else {
        cpkDatasets.acData.push(item.CPK_AC_Count || 0);
        cpkDatasets.ncData.push(item.CPK_NC_Count || 0);
        ppkDatasets.acData.push(item.PPK_AC_Count || 0);
        ppkDatasets.ncData.push(item.PPK_NC_Count || 0);
      }
      // 始终保留每个柱子的计数合计，供百分比模式下显示总数标签
      cpkDatasets.countTotals.push((item.CPK_AC_Count || 0) + (item.CPK_NC_Count || 0));
      ppkDatasets.countTotals.push((item.PPK_AC_Count || 0) + (item.PPK_NC_Count || 0));
      cpkDatasets.xLabels.push(date);
      ppkDatasets.xLabels.push(date);
      totalAC_CPK += item.CPK_AC_Count || 0;
      totalNC_CPK += item.CPK_NC_Count || 0;
      totalAC_PPK += item.PPK_AC_Count || 0;
      totalNC_PPK += item.PPK_NC_Count || 0;
    });

    let averagePercentCPK = totalAC_CPK + totalNC_CPK > 0
      ? toOneDecimal((totalAC_CPK / (totalAC_CPK + totalNC_CPK)) * 100)
      : 0;
    let averagePercentPPK = totalAC_PPK + totalNC_PPK > 0
      ? toOneDecimal((totalAC_PPK / (totalAC_PPK + totalNC_PPK)) * 100)
      : 0;

    return [
      {
        acData: cpkDatasets.acData,
        ncData: cpkDatasets.ncData,
        xLabels: cpkDatasets.xLabels,
        countTotals: cpkDatasets.countTotals,
        title: 'Dimension',
        subtitle: 'Monthly CPK',
        averagePercent: averagePercentCPK,
        totalAC: totalAC_CPK,
        totalNC: totalNC_CPK,
      },
      {
        acData: ppkDatasets.acData,
        ncData: ppkDatasets.ncData,
        xLabels: ppkDatasets.xLabels,
        countTotals: ppkDatasets.countTotals,
        title: 'Dimension',
        subtitle: 'Monthly PPK',
        averagePercent: averagePercentPPK,
        totalAC: totalAC_PPK,
        totalNC: totalNC_PPK,
      },
    ];
  };

  const datasets = processData();

  // 为isTimeSeries为true时填充缺失的月份
  const datasetsFilled = React.useMemo(() => {
    if (!isTimeSeries || !datasets || datasets.length === 0) return datasets;

    try {
      return datasets.map(dataset => {
        if (!dataset || !dataset.xLabels || dataset.xLabels.length < 1) return dataset;

        const xLabels = dataset.xLabels || [];
        const acData = dataset.acData || [];
        const ncData = dataset.ncData || [];
        const countTotals = dataset.countTotals || [];

        // 用Map快速查找原数据
        const dataMap = new Map();
        xLabels.forEach((label, idx) => {
          dataMap.set(label, {
            ac: acData[idx] ?? 0,
            nc: ncData[idx] ?? 0,
            countTotal: countTotals[idx] ?? 0,
          });
        });

        // 以 filter 的 StartMonth/EndMonth 为准
        // 若用户没有手动选择（空字符串），使用与 UI 显示一致的默认值
        const effectiveStart = filters.StartMonth || getRecent12MonthsStart();
        const effectiveEnd = filters.EndMonth || getCurrentMonth();
        const fmtStart = String(effectiveStart).includes('-') ? 'YYYY-MM' : 'YYYYMM';
        const fmtEnd = String(effectiveEnd).includes('-') ? 'YYYY-MM' : 'YYYYMM';
        let minMonth = dayjs(String(effectiveStart), fmtStart);
        let maxMonth = dayjs(String(effectiveEnd), fmtEnd);
        if (!minMonth.isValid()) minMonth = dayjs(xLabels[0], 'YYYY-MM');
        if (!maxMonth.isValid()) maxMonth = dayjs(xLabels[xLabels.length - 1], 'YYYY-MM');

        const result = { xLabels: [], acData: [], ncData: [], countTotals: [] };

        let currentMonth = minMonth;
        while (!currentMonth.isAfter(maxMonth)) {
          const monthStr = currentMonth.format('YYYY-MM');
          result.xLabels.push(monthStr);

          if (dataMap.has(monthStr)) {
            const data = dataMap.get(monthStr);
            result.acData.push(data.ac);
            result.ncData.push(data.nc);
            result.countTotals.push(data.countTotal);
          } else {
            result.acData.push(0);
            result.ncData.push(0);
            result.countTotals.push(0);
          }

          currentMonth = currentMonth.add(1, 'month');
        }

        return {
          ...dataset,
          xLabels: result.xLabels,
          acData: result.acData,
          ncData: result.ncData,
          countTotals: result.countTotals,
        };
      });
    } catch (error) {
      console.error('Error in datasetsFilled:', error);
      return datasets;
    }
  }, [isTimeSeries, datasets, filters]);

  // 为了方便使用，直接用filled版本覆盖原来的变量
  const finalDatasets = datasetsFilled;

  const handleBarClick = (params) => {
    const { dataIndex, seriesId } = params;

    // 通过 seriesId 的后缀 0/1 判断：0 -> CPK, 1 -> PPK
    const metric = seriesId.endsWith('-0') ? 'CPK'
                : seriesId.endsWith('-1') ? 'PPK'
                : undefined;

    // 选择对应的数据集（0: CPK, 1: PPK）
    const dataset = seriesId.startsWith('pvId') ? finalDatasets[0]
                  : seriesId.startsWith('uvId') ? finalDatasets[1]
                  : null;
    const resultType = seriesId.includes('pvId') ? 'ac' : 'nc';
    if (dataset) {
      const dateLabel = dataset.xLabels[dataIndex];      // '2024-09'
      const period = dateLabel && dateLabel.length === 7
        ? dateLabel.replace('-', '')                     // -> '202409'
        : dateLabel;

      if (period) {
        // 注意：resultType 你目前用的是小写 'ac'/'nc'，确保下一页也按同样约定
        drill('overall-lots-clicked-table', {
          state: { date: period, metric, resultType, ...filters, seriesId }
        });
      }
    }
  };

  // 格式化Period为"Aug 2025"，输入如"202508"
  function formatMonthYear(periodStr) {
    if (!periodStr) return '';
    // 保证 periodStr 是字符串
    const str = String(periodStr);
    // 只处理6位数字字符串
    if (/^\d{6}$/.test(str)) {
      const year = str.slice(0, 4);
      const month = str.slice(4, 6);
      const date = new Date(`${year}-${month}-01`);
      return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`;
    }
    // 兼容"2025-08"格式
    if (str.length === 7 && str[4] === '-') {
      const [year, month] = str.split('-');
      const date = new Date(`${year}-${month}-01`);
      return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`;
    }
    return str;
  }

  function getRecent12MonthsStart() {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${y}${m}`;
  }

  function getCurrentMonth() {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    return `${y}${m}`;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, px: 1.5, mt: 2, width: '100%', boxSizing: 'border-box' }}>
      {/* Top filter bar (BRD S1/G4: retractable) */}
      <Box
        className="filter-area"
        sx={{
          width: '100%',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          p: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: filterOpen ? 1.5 : 0 }}>
          <Box sx={{ display: 'inline-flex', p: '3px', borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
            {[['Count', 'Count'], ['Percent', 'Percent']].map(([val, label]) => (
              <Box key={val} onClick={() => setDisplayMode(val)} sx={{
                px: 2, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                bgcolor: displayMode === val ? 'primary.main' : 'transparent',
                color: displayMode === val ? '#fff' : 'text.secondary', transition: 'all .15s',
              }}>{label}</Box>
            ))}
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={handleClearFilters}
              startIcon={<FilterAltOffIcon fontSize="small" />}
              sx={{ fontSize: 12.5, fontWeight: 700, textTransform: 'none' }}
            >
              Clear
            </Button>
            <Tooltip title={filterOpen ? 'Collapse filters' : 'Expand filters'}>
              <IconButton size="small" onClick={() => setFilterOpen((o) => !o)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
                {filterOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
        {filterOpen && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 1.25 }}>
          {/* 只保留一套filter输入！所有字段都走filters，确保后端能收到 */}
          {FILTER_KEYS.map(key => {
            const isCAT = key === 'CAT';
            const filterValue = filters[key];
            
            return (
              <Autocomplete
                size="small"
                key={key}
                multiple={isCAT}
                options={
                  isCAT
                    ? (allOptions[key] || []).filter(v => typeof v === 'string' && v.trim() !== '')
                    : [
                        '',
                        ...((allOptions[key] || []).filter(v => typeof v === 'string' && v.trim() !== ''))
                      ]
                }
                value={isCAT ? (Array.isArray(filterValue) ? filterValue : []) : (filterValue ?? '')}
                onChange={(e, value) => handleFilterChange(key, value)}
                renderInput={params => (
                  <TextField
                    {...params}
                    label={key}
                    variant="outlined"
                    sx={{ minWidth: 160, flex: '1 1 160px' }}
                    placeholder={isCAT ? 'Select CAT' : 'All'}
                    InputLabelProps={{ sx: { '&.MuiInputLabel-shrink': { bgcolor: 'background.paper', px: 0.5, borderRadius: 0.5 } } }}
                  />
                )}
                getOptionLabel={option => (option === '' ? '' : option)}
                isOptionEqualToValue={(option, value) => option === value}
                disableClearable={isCAT}
                ListboxProps={{ style: { maxHeight: 300 } }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props;
                  return (
                    <li key={option || 'empty'} {...rest}>
                      {option === '' ? 'All' : option}
                    </li>
                  );
                }}
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
          {optionsLoading && (
            <Box sx={{ alignSelf: 'center', ml: 1 }}>
              <CircularProgress size={22} />
            </Box>
          )}
        </Box>
        )}
      </Box>
      {/* 右侧内容区域 */}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%', overflowX: 'auto' }}>
       {/*clickedDot:
         {clickedDot ? JSON.stringify(clickedDot) : '—'}
         resultType: {resultType}
       */}
        {finalDatasets.map((dataset, index) => (
          <Card elevation={0} sx={{ mt: 0, width: '100%', p: 2, mb: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }} key={index}>
            <Grid container direction="row" spacing={2}>
              <Grid item xs={12} md={2} sx={{ minWidth: 200, maxWidth: { md: 200 } }}>
                <Box sx={{ width: '100%', px: 1.5, py: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1.5 }}>
                    Dimension {dataset.subtitle.includes('PPK') ? 'Ppk' : 'Cpk'} Scorecard
                  </Typography>
                  <Stack spacing={1}>
                    <KpiTile label={`${dataset.subtitle.slice(-3)} ≥ 1 Percentage`} color={KPI.pct}
                      value={`${dataset.averagePercent.toFixed(1)}%`} />
                    <KpiTile label={`${dataset.subtitle.slice(-3)} ≥ 1 Dimension Count`} color={KPI.ac}
                      value={new Intl.NumberFormat().format(dataset.totalAC)} />
                    <KpiTile label={`${dataset.subtitle.slice(-3)} < 1 Dimension Count`} color={KPI.nc}
                      value={new Intl.NumberFormat().format(dataset.totalNC)} />
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ color: 'primary.main', fontStyle: 'italic', mt: 2, letterSpacing: 0.3 }}
                  >
                    ⓘ Important Note: Click a column bar to view details.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md sx={{ minWidth: 400, overflow: 'auto', flexGrow: 1, flexBasis: 0, maxWidth: 'none' }}>
                {loading ? (
                  // Loading state centered in the chart area (matches the Individual Lot page).
                  <Box sx={{ marginBottom: 2, minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <CircularProgress />
                    <Typography variant="h6" sx={{ ml: 2 }}>
                      Loading data...
                    </Typography>
                  </Box>
                ) : dataset.acData.length === 0 && dataset.ncData.length === 0 ? (
                  <Box sx={{ marginBottom: 2, minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <Typography sx={{ fontSize: 16, color: 'grey.600' }}>No Result</Typography>
                  </Box>
                ) : (
                  <Box sx={{ marginBottom: 2, minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'flex-start', overflowX: 'auto', width: '100%' }}>
                    <div className="custom-x-padding-bottom" style={{ width: '100%', minWidth: 600 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', textAlign: 'center', mb: 0.25 }}>
                      Dimension Monthly {dataset.subtitle.includes('PPK') ? 'Ppk' : 'Cpk'} Performance ({displayMode === 'Count' ? 'Count' : 'Percentage'})
                    </Typography>
                    {(() => {
                      const metric = dataset.subtitle.includes('PPK') ? 'PPK' : 'CPK';
                      const suffix = displayMode === 'Percent' ? '(%)' : '(Count)';
                      const xLabelsFmt = finalDatasets[index].xLabels.map(formatMonthYear);
                      // When there are many months, MUI auto-hides every other tick label.
                      // Past 14 points, force every label and angle them so they stay readable.
                      const showAllTicks = xLabelsFmt.length > 14;
                      return (
                        // BRD G4: responsive width — fills the container (parent scrolls on narrow screens).
                        <BarChart
                          height={500}
                          sx={(theme) => ({
                            marginTop: 0.5,
                            // Data labels printed on the bars in black — far more legible on the
                            // bright green (and red) segments than the default white.
                            "& .MuiBarLabel-root": {
                              fill: '#000 !important',
                            },
                            "& .MuiChartsAxis-directionY .MuiChartsAxis-label": {
                              fill: `${theme.palette.mode === 'dark' ? '#fff' : theme.palette.text.primary} !important`,
                            },
                            "& .MuiChartsAxis-directionY .MuiChartsAxis-tickLabel": {
                              fill: `${theme.palette.mode === 'dark' ? '#fff' : theme.palette.text.primary} !important`,
                            },
                          })}
                          margin={showAllTicks ? { left: 80, right: 50, top: 55, bottom: 130 } : { left: 80, right: 50, top: 38, bottom: 110 }}
                          series={[
                            {
                              data: dataset.acData,
                              label: `${metric} ≥ 1 Dimension ${suffix}`,
                              id: `pvId-${index}`,
                              stack: 'total',
                              color: '#22C55E',
                            },
                            {
                              data: dataset.ncData,
                              label: `${metric} < 1 Dimension ${suffix}`,
                              id: `uvId-${index}`,
                              stack: 'total',
                              color: '#F54D41',
                            },
                          ]}
                          
                    slotProps={{ legend: { labelStyle: { fontSize: 16 }, position: { vertical: 'bottom', horizontal: 'middle' }, direction: 'row' }, noDataOverlay: { message: 'No Result' } }}
                          xAxis={[{
                            data: xLabelsFmt,
                            scaleType: 'band',
                            tickLabelInterval: showAllTicks ? () => true : undefined,
                            tickLabelStyle: showAllTicks
                              ? { fontSize: 11, angle: 45, textAnchor: 'start' }
                              : { fontSize: 13 },
                            labelStyle: { fontSize: 13 },
                          }]}
                          yAxis={[{
                              label: displayMode === 'Percent' ? 'Percentage (%)' : 'Count (Dimension)',
                              // Percent bars top out at 100; extend the axis so the total-count
                              // label has headroom above the bar and clears the legend.
                              max: displayMode === 'Percent' ? 115 : undefined,
                              tickLabelStyle: { fontSize: 13 },
                              labelStyle: { fontSize: 13 },
                          }]}
                          value="value"
                          barLabel={({ value }) => {
                              const num = Number(value);
                              if (!Number.isFinite(num) || num === 0) return '';
                              if (displayMode === 'Percent') {
                                return num.toFixed(1);
                              }
                              return new Intl.NumberFormat().format(num);
                          }}
                          // onItemClick={(event, data) => {handleBarClick(data); setClickDot(data)}}
                          
                          onItemClick={(event, data) => { setClickDot(data); setResultType(data.seriesId.includes('pvId') ? 'ac' : 'nc'); handleBarClick(data);}}
                        >
                          {displayMode === 'Count' && (
                            <StackTotalLabels
                              categories={xLabelsFmt}
                              totals={dataset.countTotals || []}
                              angle={showAllTicks ? -90 : 0}
                            />
                          )}
                        </BarChart>
                      );
                    })()}
                    </div>
                  </Box>
                )}
              </Grid>
            </Grid>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default LotsCPPKBarChart;