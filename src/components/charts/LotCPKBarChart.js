//TODO: Swagger 文档是什么

import React, { useEffect, useState, useMemo, useContext } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { legendClasses } from '@mui/x-charts/ChartsLegend';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Switch,
  TextField,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import axios from 'axios';
import useDrilldownNavigate from '../../utils/useDrilldownNavigate';
import { Autocomplete } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import './NCLotRankBar.css';
import { useValue } from '../../context/ContextProvider';
import { LineChart } from '@mui/x-charts/LineChart';
import dayjs from 'dayjs';
import { TimeSeriesContext } from '../../context/TimeSeriesContext';
import StackTotalLabels from './StackTotalLabels';
import KpiTile, { KPI } from './KpiTile';

const FILTER_KEYS = ['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT', 'CarbonizingFurnace', 'TemperingFurnace'];

const LotCPKBarChart = () => {
  const { state, dispatch } = useValue();
  const drill = useDrilldownNavigate();
  const { isTimeSeries } = useContext(TimeSeriesContext); // 从context读取时间序列标志

  // 初始化filters：仅在完全没有历史筛选记录时使用 HT/HTF 默认值。
  // 一旦有任意历史记录，Dept/MachineId 不再回填默认。
  const [filters, setFilters] = useState(() => {
    const saved = state?.filters || {};
    const hasSavedFilters = Object.keys(saved).length > 0;
    return {
      Dept: hasSavedFilters ? (saved.Dept ?? '') : 'HT',
      MachineId: hasSavedFilters ? (saved.MachineId ?? '') : 'HTFDCATE-L1',
      MaterialDesc: saved.MaterialDesc ?? '',
      DimensionDesc: saved.DimensionDesc ?? '',
      // BRD S3: default CAT selection is multi-select CTQ/CTP/NOR. Treat an empty
      // array (e.g. left over from a prior Clear / another page) as "use default" too.
      CAT: (Array.isArray(saved.CAT) && saved.CAT.length) ? saved.CAT : ['CTQ', 'CTP', 'NOR'],
      StartMonth: saved.StartMonth ?? '',
      EndMonth: saved.EndMonth ?? '',
      CarbonizingFurnace: saved.CarbonizingFurnace ?? '',
      TemperingFurnace: saved.TemperingFurnace ?? '',
    };
  });

  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [displayMode, setDisplayMode] = useState('Count');
  const [allOptions, setAllOptions] = useState({
    Dept: [],
    MachineId: [],
    MaterialDesc: [],
    DimensionDesc: [],
    CAT: [],
    StartMonth: [],
    EndMonth: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [filterOpen, setFilterOpen] = useState(true); // BRD S1/G4: retractable filter panel

  // 同步filters到context
  useEffect(() => {
    dispatch({ type: 'UPDATE_FILTERS', payload: filters });
  }, [filters, dispatch]);

  // 获取filter options
  useEffect(() => {
    let cancelled = false;
    const fetchFilterOptions = async () => {
      setOptionsLoading(true);
      try {
        const filterToSend = { ...filters };
        // 字段名映射
        if (filterToSend.CarbonizingFurnace) filterToSend.BatchMC2 = filterToSend.CarbonizingFurnace;
        delete filterToSend.CarbonizingFurnace;
        if (filterToSend.TemperingFurnace) filterToSend.BatchMC4 = filterToSend.TemperingFurnace;
        delete filterToSend.TemperingFurnace;
        delete filterToSend.CAT;
        // 不传月份给filter-options，保证月份候选项永远来自完整数据集
        delete filterToSend.StartMonth;
        delete filterToSend.EndMonth;
        const response = await axios.post(`${window.baseURL}/unified-data-filter-options`, { filter: filterToSend });
        if (!cancelled) {
          setAllOptions(response.data || {});
        }
      } catch (error) {
        if (!cancelled) setAllOptions({});
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    };
    fetchFilterOptions();
    return () => { cancelled = true; };
  }, [filters]);

  // 获取图表数据
  useEffect(() => {
    let didCancel = false;

    const fetchData = async () => {
      setDataLoading(true);
      setDailyData(null);
      setMonthlyData(null);
      try {
        const filtersToSend = { ...filters };

        const [dailyResp, monthlyResp] = await Promise.all([
          axios.post(`${window.baseURL}/unified-data`, {
            dataType: 'ACNCdata_daily',
            filter: filtersToSend,
          }),
          axios.post(`${window.baseURL}/unified-data`, {
            dataType: 'ACNCdata_monthly',
            filter: filtersToSend,
          }),
        ]);

        if (!didCancel) {
          console.log('API Daily Response:', dailyResp.data); // 调试：查看 API 返回格式
          console.log('API Monthly Response:', monthlyResp.data); // 调试：查看 API 返回格式
          setDailyData(dailyResp.data || []);
          setMonthlyData(monthlyResp.data || []);
        }
      } catch (error) {
        if (!didCancel) {
          setDailyData([]);
          setMonthlyData([]);
        }
        console.error('Error fetching ACNC data:', error);
      } finally {
        if (!didCancel) setDataLoading(false);
      }
    };

    fetchData();
    return () => { didCancel = true; };
  }, [filters, displayMode]);

  const monthOptions = useMemo(() => 
    Array.from(new Set([
      ...(allOptions.StartMonth || []),
      ...(allOptions.EndMonth || [])
    ])).sort((a, b) => a.localeCompare(b)),
    [allOptions]
  );

  const startMonthOptions = useMemo(() => {
    if (!filters.EndMonth) return monthOptions;
    return monthOptions.filter(m => m <= filters.EndMonth);
  }, [monthOptions, filters.EndMonth]);

  const endMonthOptions = useMemo(() => {
    if (!filters.StartMonth) return monthOptions;
    return monthOptions.filter(m => m >= filters.StartMonth);
  }, [monthOptions, filters.StartMonth]);

  const handleFilterChange = (key, value) => {
    setFilters(prevFilters => {
      let updatedValue = value;
      
      // CAT多选处理
      if (key === 'CAT') {
        updatedValue = Array.isArray(value) ? value.filter(v => v && v.trim() !== '') : [];
      }

      return { ...prevFilters, [key]: updatedValue };
    });
  };

  const handleClearFilters = () => {
    const cleared = {
      Dept: '',
      MachineId: '',
      MaterialDesc: '',
      DimensionDesc: '',
      CAT: ['CTQ', 'CTP', 'NOR'], // BRD S3: reset to the default CAT selection, not empty
      StartMonth: '',
      EndMonth: '',
      CarbonizingFurnace: '',
      TemperingFurnace: '',
    };
    setFilters(cleared);
  };

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

  function getDatasetsFromApiData(apiData, mode) {
    // 处理空数据
    if (!apiData) {
      return {
        acData: [],
        ncData: [],
        xLabels: [],
        totalAC: 0,
        totalNC: 0,
        averagePercentage: 0,
        acPercent: [],
        ncPercent: [],
      };
    }
    
    // 如果 apiData 是数组，说明 API 返回的数据需要处理
    if (Array.isArray(apiData)) {
      console.warn('API returned array format, expected object with xLabels/acData fields');
      return {
        acData: [],
        ncData: [],
        xLabels: [],
        totalAC: 0,
        totalNC: 0,
        averagePercentage: 0,
        acPercent: [],
        ncPercent: [],
      };
    }
    
    // 检查 apiData 是否有必要的字段
    if (!apiData.xLabels || apiData.xLabels.length === 0) {
      return {
        acData: [],
        ncData: [],
        xLabels: [],
        totalAC: 0,
        totalNC: 0,
        averagePercentage: 0,
        acPercent: [],
        ncPercent: [],
      };
    }
    
    const toFixedDigits = mode === 'monthly' ? 1 : 2;
    return {
      acData: apiData.acData ?? [],
      ncData: apiData.ncData ?? [],
      xLabels: apiData.xLabels ?? [],
      totalAC: apiData.totalAC ?? 0,
      totalNC: apiData.totalNC ?? 0,
      averagePercentage: apiData.averagePercentage ?? 0,
      acPercent: apiData.acPercent
        ? apiData.acPercent.map(v => Number(v).toFixed(toFixedDigits))
        : [],
      ncPercent: apiData.ncPercent
        ? apiData.ncPercent.map(v => Number(v).toFixed(toFixedDigits))
        : [],
    };
  }

  const dailyDatasets = getDatasetsFromApiData(dailyData, 'daily');
  const monthlyDatasets = getDatasetsFromApiData(monthlyData, 'monthly');

  // 简单填补缺失的月份/日期 - 只在isTimeSeries为true时执行
  const monthlyDatasetsFilled = React.useMemo(() => {
    if (!isTimeSeries || !monthlyDatasets.xLabels || monthlyDatasets.xLabels.length < 1) {
      return monthlyDatasets;
    }
    
    try {
      const xLabels = monthlyDatasets.xLabels || [];
      const acData = monthlyDatasets.acData || [];
      const ncData = monthlyDatasets.ncData || [];
      const acPercent = monthlyDatasets.acPercent || [];
      const ncPercent = monthlyDatasets.ncPercent || [];
      
      // 自动检测日期格式
      const firstLabel = String(xLabels[0]);
      let dateFormat = 'YYYYMM'; // 默认
      if (firstLabel.includes('-')) {
        dateFormat = 'YYYY-MM';
      }
      
      console.log('Gap Filling Monthly: detected format=' + dateFormat, { originalLabels: xLabels.length }); // 调试
      
      // 用Map快速查找原数据
      const dataMap = new Map();
      xLabels.forEach((label, idx) => {
        dataMap.set(String(label), {
          ac: acData[idx] ?? 0,
          nc: ncData[idx] ?? 0,
          acPct: acPercent[idx] ?? '0.0',
          ncPct: ncPercent[idx] ?? '0.0',
        });
      });
      
      // 确定范围：以 filter 的 StartMonth/EndMonth 为准
      // 若用户没有手动选择（空字符串），使用与 UI 显示一致的默认值
      const effectiveStart = filters.StartMonth || getRecent12MonthsStart();
      const effectiveEnd = filters.EndMonth || getCurrentMonth();

      const fmtStart = String(effectiveStart).includes('-') ? 'YYYY-MM' : 'YYYYMM';
      const fmtEnd = String(effectiveEnd).includes('-') ? 'YYYY-MM' : 'YYYYMM';
      let minMonth = dayjs(String(effectiveStart), fmtStart);
      let maxMonth = dayjs(String(effectiveEnd), fmtEnd);

      // 格式统一：gap-fill 需要与 xLabels 格式匹配
      if (!minMonth.isValid()) minMonth = dayjs(String(xLabels[0]), dateFormat);
      if (!maxMonth.isValid()) maxMonth = dayjs(String(xLabels[xLabels.length - 1]), dateFormat);
      
      if (!minMonth.isValid() || !maxMonth.isValid()) {
        console.warn('Invalid date range for gap filling', { minMonth, maxMonth });
        return monthlyDatasets;
      }
      
      const result = { xLabels: [], acData: [], ncData: [], acPercent: [], ncPercent: [] };
      
      let currentMonth = minMonth;
      let filledCount = 0;
      
      while (!currentMonth.isAfter(maxMonth)) {
        const monthStr = currentMonth.format(dateFormat);
        result.xLabels.push(monthStr);
        
        if (dataMap.has(monthStr)) {
          const data = dataMap.get(monthStr);
          result.acData.push(data.ac);
          result.ncData.push(data.nc);
          result.acPercent.push(data.acPct);
          result.ncPercent.push(data.ncPct);
        } else {
          // 填补缺失月份用 null 而非 0，让图表不显示这个月份的数据
          result.acData.push(null);
          result.ncData.push(null);
          result.acPercent.push(null);
          result.ncPercent.push(null);
          filledCount++;
        }
        
        currentMonth = currentMonth.add(1, 'month');
      }
      
      console.log('After Gap Filling:', { 
        totalMonths: result.xLabels.length, 
        filledMonths: filledCount, 
        originalMonths: xLabels.length,
        range: `${minMonth.format(dateFormat)} - ${maxMonth.format(dateFormat)}`
      }); // 调试
      
      return {
        ...monthlyDatasets,
        xLabels: result.xLabels,
        acData: result.acData,
        ncData: result.ncData,
        acPercent: result.acPercent,
        ncPercent: result.ncPercent,
      };
    } catch (error) {
      console.error('Error in monthlyDatasetsFilled:', error);
      return monthlyDatasets;
    }
  }, [isTimeSeries, monthlyDatasets, filters]);

  // 简单填补缺失的日期 - 只在isTimeSeries为true时执行
  const dailyDatasetsFilled = React.useMemo(() => {
    if (!isTimeSeries || !dailyDatasets.xLabels || dailyDatasets.xLabels.length < 1) {
      return dailyDatasets;
    }
    
    try {
      const xLabels = dailyDatasets.xLabels || [];
      const acData = dailyDatasets.acData || [];
      const ncData = dailyDatasets.ncData || [];
      const acPercent = dailyDatasets.acPercent || [];
      const ncPercent = dailyDatasets.ncPercent || [];
      
      // 自动检测日期格式
      const firstLabel = String(xLabels[0]);
      let dateFormat = 'YYYYMMDD'; // 默认
      if (firstLabel.includes('-')) {
        dateFormat = 'YYYY-MM-DD';
      }
      
      console.log('Gap Filling Daily: detected format=' + dateFormat, { originalDays: xLabels.length }); // 调试
      
      // 用Map快速查找原数据
      const dataMap = new Map();
      xLabels.forEach((label, idx) => {
        dataMap.set(String(label), {
          ac: acData[idx] ?? 0,
          nc: ncData[idx] ?? 0,
          acPct: acPercent[idx] ?? '0.00',
          ncPct: ncPercent[idx] ?? '0.00',
        });
      });
      
      // 以 filter 的 StartMonth/EndMonth 为准（月初/月末），没设则用与UI一致的默认值
      const effectiveStart = filters.StartMonth || getRecent12MonthsStart();
      const effectiveEnd = filters.EndMonth || getCurrentMonth();
      const fmtStart = String(effectiveStart).includes('-') ? 'YYYY-MM' : 'YYYYMM';
      const fmtEnd = String(effectiveEnd).includes('-') ? 'YYYY-MM' : 'YYYYMM';
      let minDate = dayjs(String(effectiveStart), fmtStart).startOf('month');
      let maxDate = dayjs(String(effectiveEnd), fmtEnd).endOf('month');
      if (!minDate.isValid()) minDate = dayjs(String(xLabels[0]), dateFormat);
      if (!maxDate.isValid()) maxDate = dayjs(String(xLabels[xLabels.length - 1]), dateFormat);
      
      if (!minDate.isValid() || !maxDate.isValid()) {
        console.warn('Invalid date range for daily gap filling', { minDate, maxDate });
        return dailyDatasets;
      }
      
      const result = { xLabels: [], acData: [], ncData: [], acPercent: [], ncPercent: [] };
      
      let currentDate = minDate;
      let filledCount = 0;
      
      while (!currentDate.isAfter(maxDate)) {
        const dateStr = currentDate.format(dateFormat);
        result.xLabels.push(dateStr);
        
        if (dataMap.has(dateStr)) {
          const data = dataMap.get(dateStr);
          result.acData.push(data.ac);
          result.ncData.push(data.nc);
          result.acPercent.push(data.acPct);
          result.ncPercent.push(data.ncPct);
        } else {
          // 没有数据的日子按 0 处理（NULL 等同于 0），使折线保持连续
          result.acData.push(0);
          result.ncData.push(0);
          result.acPercent.push('0.00');
          result.ncPercent.push('0.00');
          filledCount++;
        }
        
        currentDate = currentDate.add(1, 'day');
      }
      
      console.log('After Daily Gap Filling:', { 
        totalDays: result.xLabels.length, 
        filledDays: filledCount, 
        originalDays: xLabels.length 
      }); // 调试
      
      return {
        ...dailyDatasets,
        xLabels: result.xLabels,
        acData: result.acData,
        ncData: result.ncData,
        acPercent: result.acPercent,
        ncPercent: result.ncPercent,
      };
    } catch (error) {
      console.error('Error in dailyDatasetsFilled:', error);
      return dailyDatasets;
    }
  }, [isTimeSeries, dailyDatasets]);

  const firstTickLabelByMonth = useMemo(() => {
    const labelSet = new Set();
    let previousMonthKey = '';

    (dailyDatasetsFilled.xLabels || []).forEach((item) => {
      const d = dayjs(item);
      if (!d.isValid()) return;
      const monthKey = d.format('YYYY-MM');
      if (monthKey !== previousMonthKey) {
        labelSet.add(d.format('MMM D, YYYY'));
        previousMonthKey = monthKey;
      }
    });

    return labelSet;
  }, [dailyDatasetsFilled.xLabels]);

  // Past 14 months the x-axis ticks and the on-top total labels are stood up
  // vertically so none are hidden or overlapping.
  const monthlyManyPoints = monthlyDatasetsFilled.xLabels.length > 14;
  // Same logic for the daily line chart: past 14 visible (per-month) tick labels,
  // angle them 45° and give the plot extra bottom room so none overlap/clip.
  const dailyManyPoints = firstTickLabelByMonth.size > 14;

  // Daily chart has many points; give it a wide fixed width (≈8px/point) so it
  // overflows its container and scrolls horizontally instead of cramming together.
  const dailyWidth = Math.max(1000, (dailyDatasetsFilled.xLabels?.length || 0) * 8 + 130);

  // Whether there is any real (non-null) value to plot. When the filter matches
  // nothing, gap-filling can still leave null-filled arrays, which render an
  // empty chart that pops a broken "NaN / null%" tooltip on hover — so we show a
  // plain "No Result" placeholder instead of the chart in that case.
  const monthlyHasData =
    (monthlyDatasetsFilled.acData || []).some((v) => v != null) ||
    (monthlyDatasetsFilled.ncData || []).some((v) => v != null);
  const dailyHasData =
    (dailyDatasetsFilled.acData || []).some((v) => v != null) ||
    (dailyDatasetsFilled.ncData || []).some((v) => v != null);

  const handleBarClick = (event, d, dataset) => {
    const dataIndex = d.dataIndex;
    if (!dataset) return;
    const date = dataset.xLabels[dataIndex];
    const seriesId = d.seriesId;
    let periodType;
    let filtersToSend = { ...filters }; // 继承当前所有filter
    delete filtersToSend.StartMonth;
    delete filtersToSend.EndMonth;
    if (date && date.length === 7) {
      periodType = 'month';
      filtersToSend.Period = date.replace('-', '');
    } else if (date && date.length === 10) {
      periodType = 'date';
      filtersToSend.MeasDate = date;
    } else {
      periodType = 'unknown';
    }
    console.log('Bar clicked:', { date, periodType, filtersToSend, seriesId});
    drill('individual-lot-clicked-table', { state: { date: date.toString(), periodType, filters: filtersToSend,seriesId } });
  };

  if (optionsLoading && Object.keys(allOptions).every(k => allOptions[k].length === 0)) {
    return (
      <Grid container justifyContent="center" alignItems="center" sx={{ height: '80vh' }}>
        <Box sx={{ width: 400 }}>
          <Typography variant="h6" sx={{ mb: 2, color: '#1976d2', textAlign: 'center' }}>
            Loading filter options...
          </Typography>
          <CircularProgress />
        </Box>
      </Grid>
    );
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
            {[['Count', 'Count'], ['Percentage', 'Percent']].map(([val, label]) => (
              <Box
                key={val}
                onClick={() => setDisplayMode(val)}
                sx={{
                  px: 2, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                  bgcolor: displayMode === val ? 'primary.main' : 'transparent',
                  color: displayMode === val ? '#fff' : 'text.secondary',
                  transition: 'all .15s',
                }}
              >
                {label}
              </Box>
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
          {FILTER_KEYS.map((key) => {
            const isCAT = key === 'CAT';
            const filterValue = filters[key];
            const isFurnace = key === 'CarbonizingFurnace' || key === 'TemperingFurnace' || key === 'Dept' || key === 'CAT';

            const FILTER_DISPLAY_NAMES = { CarbonizingFurnace: 'CarburizingFurnace' };
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
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label={FILTER_DISPLAY_NAMES[key] ?? key}
                    variant="outlined"
                    sx={isFurnace ? { minWidth: 145, flex: '0 1 145px' } : { minWidth: 160, flex: '1 1 160px' }}
                    placeholder={isCAT ? 'Select CAT' : 'All'}
                    InputLabelProps={{ sx: { '&.MuiInputLabel-shrink': { bgcolor: 'background.paper', px: 0.5, borderRadius: 0.5 } } }}
                  />
                )}
                getOptionLabel={(option) => option === '' ? '' : option}
                isOptionEqualToValue={(option, value) => option === value}
                disableClearable={isCAT}
                ListboxProps={{ style: { maxHeight: 300 } }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props;
                  return (
                    <li {...rest} key={option || 'empty'}>
                      {option === '' ? 'All' : option}
                    </li>
                  );
                }}
                // renderTags={() => isCAT ? null : undefined}
                
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
        </Box>
        )}
      </Box>

      {/* 内容区 */}
      <Box sx={{ flex: 1, minWidth: 0, width: '100%', overflowX: 'auto' }}>
        {/* Monthly Chart */}
        <Card sx={{ mt: 0, width: '100%', p: 2, pb: 1, mb: 2.5 }}>
          <Grid container direction="row" spacing={2}>
            {/* Overview */}
            <Grid item xs={12} md={2} sx={{ maxWidth: { md: 200 } }}>
              <Box sx={{ width: '100%', px: 1.5, py: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                  Individual Lot
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600, mb: 1.5 }}>
                  Monthly CPK
                </Typography>
                <Stack spacing={1}>
                  <KpiTile label="CPK ≥ 1 Percentage" color={KPI.pct}
                    value={`${monthlyDatasetsFilled.averagePercentage.toFixed(1)}%`} />
                  {displayMode === 'Count' && (
                    <>
                      <KpiTile label="CPK ≥ 1 Lots Count" color={KPI.ac}
                        value={new Intl.NumberFormat().format(monthlyDatasetsFilled.totalAC)} />
                      <KpiTile label="CPK < 1 Lots Count" color={KPI.nc}
                        value={new Intl.NumberFormat().format(monthlyDatasetsFilled.totalNC)} />
                    </>
                  )}
                </Stack>
              </Box>
            </Grid>
            {/* Bar chart */}
            <Grid item xs={12} md sx={{ minWidth: 400, overflow: 'auto', flexGrow: 1, flexBasis: 0, maxWidth: 'none' }}>
              <Typography
                variant="body2"
                sx={{ color: 'primary.main', fontStyle: 'italic', mb: 1, ml: 1, letterSpacing: 0.3 }}
              >
                ⓘ Important Note: Click a column bar to view details.
              </Typography>
              <Box sx={{ marginBottom: 2, width: '100%', overflowX: 'auto' }}>
                {dataLoading || monthlyData === null ? (
                  <Box sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress />
                    <Typography variant="h6" sx={{ ml: 2 }}>
                      Loading data...
                    </Typography>
                  </Box>
                ) : !monthlyHasData ? (
                  <Box sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: 16, color: 'grey.600' }}>No Result</Typography>
                  </Box>
                ) : (
                  // <div className="custom-x-padding-bottom">
                  <div style={{ width: '100%', minWidth: 520 }}>
                    <BarChart
                      height={370}
                      sx={(theme) => ({
                        "& .MuiChartsAxis-directionY .MuiChartsAxis-label": {
                          fill: `${theme.palette.primary.main} !important`,
                          transform: "translateX(-25px) !important",
                        },
                      })}
                      slotProps={{ legend: { labelStyle: { fontSize: 16 }, position: { vertical: 'bottom', horizontal: 'middle' }, direction: 'row' }, noDataOverlay: { message: 'No Result' } }}
                      margin={{ left: 80, right: 50, top: monthlyManyPoints ? 70 : 50, bottom: monthlyManyPoints ? 130 : 110 }}
                      series={[
                        {
                          data: displayMode === 'Percentage' ? monthlyDatasetsFilled.acPercent : monthlyDatasetsFilled.acData,
                          label: displayMode === 'Percentage' ? 'Cpk ≥ 1 Individual Lot (%)' : 'Cpk ≥ 1 Individual Lot (Count)',
                          id: `acId-month`,
                          stack: 'total',
                          color: '#22C55E',
                        },
                        {
                          data: displayMode === 'Percentage' ? monthlyDatasetsFilled.ncPercent : monthlyDatasetsFilled.ncData,
                          label: displayMode === 'Percentage' ? 'Cpk < 1 Individual Lot (%)' : 'Cpk < 1 Individual Lot (Count)',
                          id: `ncId-month`,
                          stack: 'total',
                          color: '#F54D41',
                        },
                      ]}
                      xAxis={[{
                        data: monthlyDatasetsFilled.xLabels.map(formatMonthYear),
                        scaleType: 'band',
                        // Past 14 points, force every tick label and angle them so none are hidden.
                        tickLabelInterval: monthlyManyPoints ? () => true : undefined,
                        tickLabelStyle: monthlyManyPoints
                          ? { fontSize: 11, angle: 45, textAnchor: 'start' }
                          : { fontSize: 13 },
                        labelStyle: { fontSize: 13 },
                      }]}
                      yAxis={[{
                        label: displayMode === 'Percentage' ? 'Percentage (%)' : 'Count (Lots)',
                        color: 'lightblue',
                        // Percent bars top out at 100; extend the axis so the total-count
                        // label has headroom above the bar and clears the legend.
                        max: displayMode === 'Percentage' ? 115 : undefined,
                        tickLabelStyle: { fontSize: 13 },
                        labelStyle: { fontSize: 13 },
                      }]}
                      value="value"
                      barLabel={({ value }) => {
                        // const str = value?.toString() ?? '';
                        // if (str.slice(0, 4) === '2023') return ''; 
                        const num = Number(value);
                        if (isNaN(num) || num === 0) return '';
                        return new Intl.NumberFormat().format(num); // Format numbers with thousand separators
                      }}
                      onItemClick={(event, d) => handleBarClick(event, d, monthlyDatasetsFilled)}
                    >
                      <StackTotalLabels
                        categories={monthlyDatasetsFilled.xLabels.map(formatMonthYear)}
                        totals={monthlyDatasetsFilled.acData.map((ac, i) => (Number(ac) || 0) + (Number(monthlyDatasetsFilled.ncData[i]) || 0))}
                        positions={displayMode === 'Percentage'
                          ? monthlyDatasetsFilled.acPercent.map((ac, i) => (Number(ac) || 0) + (Number(monthlyDatasetsFilled.ncPercent[i]) || 0))
                          : undefined}
                        labels={displayMode === 'Percentage'
                          ? monthlyDatasetsFilled.acData.map((ac, i) => new Intl.NumberFormat().format((Number(ac) || 0) + (Number(monthlyDatasetsFilled.ncData[i]) || 0)))
                          : undefined}
                        angle={monthlyManyPoints ? -90 : 0}
                      />
                    </BarChart>
                  </div>
                )}
              </Box>
            </Grid>
          </Grid>
        </Card>
        {/* clickedDot: {clickedDot ? JSON.stringify(clickedDot) : '—'} */}
        {/* Daily Chart */}
        <Card sx={{ mt: 0, width: '100%', p: 2, mb: 3 }}>
          <Grid container direction="row" spacing={2}>
            {/* Overview area */}
            <Grid item xs={12} md={2} sx={{ maxWidth: { md: 200 } }}>
              <Box sx={{ width: '100%', px: 1.5, py: 1 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1.5 }}>
                  Lot Daily CPK
                </Typography>
                <Stack spacing={1}>
                  <KpiTile label="CPK ≥ 1 Percentage" color={KPI.pct}
                    value={`${dailyDatasetsFilled.averagePercentage.toFixed(1)}%`} />
                  {displayMode === 'Count' && (
                    <>
                      <KpiTile label="CPK ≥ 1 Lots Count" color={KPI.ac}
                        value={new Intl.NumberFormat().format(dailyDatasetsFilled.totalAC)} />
                      <KpiTile label="CPK < 1 Lots Count" color={KPI.nc}
                        value={new Intl.NumberFormat().format(dailyDatasetsFilled.totalNC)} />
                    </>
                  )}
                </Stack>
              </Box>
            </Grid>
            {/* Line chart */}
            <Grid item xs={12} md sx={{ minWidth: 400, overflow: 'auto', flexGrow: 1, flexBasis: 0, maxWidth: 'none' }}>
              <Typography
                variant="body2"
                sx={{ color: 'primary.main', fontStyle: 'italic', mb: 1, ml: 1, letterSpacing: 0.3 }}
              >
                ⓘ Important Note: Click a line data point to view details.
              </Typography>
              <Box sx={{ marginBottom: 2, overflowX: 'auto', width: '100%' }}>
                {dataLoading || dailyData === null ? (
                  <Box sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CircularProgress />
                    <Typography variant="h6" sx={{ ml: 2 }}>
                      Loading data...
                    </Typography>
                  </Box>
                ) : !dailyHasData ? (
                  <Box sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: 16, color: 'grey.600' }}>No Result</Typography>
                  </Box>
                ) : (
                  <div style={{ width: dailyWidth, minWidth: 520 }}>
                  <LineChart
                    width={dailyWidth}
                    sx={(theme) => ({
                      "& .MuiMarkElement-root": {
                        scale: "0.8",
                      },
                      "& .MuiChartsAxis-directionY .MuiChartsAxis-label": {
                        fill: `${theme.palette.primary.main} !important`,
                        transform: "translateX(-25px) !important",
                      },
                    })}
                    slotProps={{ legend: { hidden: true }, noDataOverlay: { message: 'No Result' } }}
                    margin={{ left: 80, right: 50, top: 30, bottom: dailyManyPoints ? 90 : 70 }}
                    onMarkClick={(event, d) => handleBarClick(event, d, dailyDatasetsFilled)}
                    height={340}

                    series={[
                      {
                        data: displayMode === 'Percentage' ? dailyDatasetsFilled.acPercent : dailyDatasetsFilled.acData,
                        label: displayMode === 'Percentage' ? 'CPK ≥ 1 Individual Lot (%)' : 'Cpk ≥ 1 Individual Lot (Count)',
                        id: 'acId-day',
                        color: '#22C55E',
                        connectNulls: true, // NULL 等同于 0 — 保持折线连续
                        showMark: true,          // 显示每天的点
                        curve: 'linear',
                        valueFormatter: (v) =>
                          (v === null || v === undefined)
                            ? null // null → omit this series' row from the tooltip
                            : (displayMode === 'Percentage' ? `${v}%` : `${v}`),
                      },
                      {
                        data: displayMode === 'Percentage' ? dailyDatasetsFilled.ncPercent : dailyDatasetsFilled.ncData,
                        label: displayMode === 'Percentage' ? 'CPK < 1 Individual Lot (%)' : 'CPK < 1 Individual Lot (Count)',
                        id: 'ncId-day',
                        color: 'red',
                        connectNulls: true, // NULL 等同于 0 — 保持折线连续
                        showMark: true,         // 显示每天的点
                        curve: 'linear',
                        valueFormatter: (v) =>
                          (v === null || v === undefined)
                            ? null // null → omit this series' row from the tooltip
                            : (displayMode === 'Percentage' ? `${v}%` : `${v}`),
                      },
                    ]}
                    xAxis={[{
                      data: dailyDatasetsFilled.xLabels.map(item => dayjs(item).format("MMM D, YYYY") ?? ''),
                      scaleType: 'band',
                      tickLabelInterval: () => true,
                      tickLabelStyle: dailyManyPoints
                        ? { fontSize: 11, angle: 45, textAnchor: 'start' }
                        : { fontSize: 13 },
                      labelStyle: { fontSize: 13 },
                      valueFormatter: (value, context) => {
                        if (context?.location !== 'tick') return value;
                        return firstTickLabelByMonth.has(value) ? value : '';
                      },
                    }]}
                    // 折线图不需要 value / barLabel
                    // 可选：自定义网格/轴格式
                    yAxis={[
                      {
                        label: displayMode === 'Percentage' ? 'Percentage (%)' : 'Count (Lots)',
                        tickLabelStyle: { fontSize: 13 },
                        labelStyle: { fontSize: 13 },
                      }
                    ]}
                    grid={{ vertical: true, horizontal: true }}
                  />
                  </div>
                )}
              </Box>
              {/* Static legend outside the horizontally-scrolling chart so it's always visible */}
              {!dataLoading && dailyData !== null && dailyHasData && (
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'wrap', mt: 1 }}>
                  {[
                    { color: '#22C55E', label: displayMode === 'Percentage' ? 'Cpk ≥ 1 Individual Lot (%)' : 'Cpk ≥ 1 Individual Lot (Count)' },
                    { color: 'red', label: displayMode === 'Percentage' ? 'CPK < 1 Individual Lot (%)' : 'CPK < 1 Individual Lot (Count)' },
                  ].map((item) => (
                    <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 16, height: 16, borderRadius: 0.5, backgroundColor: item.color }} />
                      <Typography sx={{ fontSize: 14 }}>{item.label}</Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
        </Card>

      </Box>
    </Box>
  );
};

export default LotCPKBarChart;