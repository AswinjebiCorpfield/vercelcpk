import React, { useEffect, useState, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { Typography, Grid, CircularProgress, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { metricColor } from '../../utils/metricFormat';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Slider from '@mui/material/Slider';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import axios from 'axios';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { PieChart, pieArcLabelClasses } from '@mui/x-charts/PieChart';
import * as d3 from 'd3-array';
import CsvExportButton, { buildExportFilename } from '../CsvExportButton';
import { TimeSeriesContext } from '../../context/TimeSeriesContext';


const PlotlyComponent = createPlotlyComponent(Plotly);
// (SLIDER_WIDTH floor removed — layout is now fluid/responsive)
const CHART_HEIGHT = 520;

const PIE_COLORS = [
  '#4FC3F7', '#81C784', '#FFD54F', '#FF8A65', '#BA68C8', '#F06292', '#FFF176', '#AED581', '#9575CD', '#64B5F6'
];
const PIE_COLORS_MC4 = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28CFF', '#FF6699', '#FFB347', '#B6FFB3', '#FF6666', '#66B3FF',
  '#FFB6C1', '#B3B6FF', '#FFD700', '#B3FFD9', '#FF8C00', '#8CFF8C', '#8C8CFF', '#FF8CB3', '#B3FF8C', '#8CB3FF'
];
const DEFAULT_DOT_COLOR = '#13133F';
const UNMATCHED_DOT_COLOR = 'rgba(128,128,128,0.1)';

const normalizeMonthValue = (value) => {
  if (!value) return '';
  const stringValue = String(value);
  if (/^\d{6}$/.test(stringValue)) return stringValue;
  if (/^\d{4}-\d{2}$/.test(stringValue)) return stringValue.replace('-', '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) return stringValue.slice(0, 7).replace('-', '');
  return '';
};

const monthToBoundaryDateString = (monthValue, boundary) => {
  const normalizedMonth = normalizeMonthValue(monthValue);
  if (!normalizedMonth) return null;
  const year = normalizedMonth.slice(0, 4);
  const month = normalizedMonth.slice(4, 6);
  const baseDate = dayjs(`${year}-${month}-01`);
  if (!baseDate.isValid()) return null;
  return (boundary === 'end' ? baseDate.endOf('month') : baseDate.startOf('month')).format('MM/DD/YYYY');
};

const buildContinuousDateRange = (startDateString, endDateString) => {
  if (!startDateString || !endDateString) return [];

  const startDate = dayjs(startDateString, 'MM/DD/YYYY');
  const endDate = dayjs(endDateString, 'MM/DD/YYYY');

  if (!startDate.isValid() || !endDate.isValid() || startDate.isAfter(endDate, 'day')) {
    return [];
  }

  const dates = [];
  let currentDate = startDate;

  while (!currentDate.isAfter(endDate, 'day')) {
    dates.push(currentDate.format('MM/DD/YYYY'));
    currentDate = currentDate.add(1, 'day');
  }

  return dates;
};

// 子组件：封装原先的 renderChartBlock，允许在内部使用 hooks
function ChartBlock({
  data,
  title,
  dateRange,
  setDateRange,
  availableDatesRaw,
  sliderDatesRaw,
  sliderDatesDisplay,
  minSlider,
  maxSlider,
  safeSliderValue,
  isDateAvailable,
  hoveredX,
  setHoveredX,
  loading,
  clickedFurnace,
  setClickedFurnace,
  // 饼图数据来源拆分：MC2 用 HRA 数组，MC4 用 HRC 数组
  pieHRAData,
  pieHRCData,
  hraSummary,
  hrcSummary,
  initialStatisticsValue,
  showGlobalControls,
  allDataForGlobalRange,  // 用于计算固定Y轴范围的全部数据
  isTimeSeries, // 新增：时间序列标志
  startMonth, // 新增：开始月份 (YYYY-MM 格式)
  endMonth, // 新增：结束月份 (YYYY-MM 格式)
}) {
  const navigate = useNavigate();
  const theme = useTheme();
  const axisTextColor = theme.palette.text.primary;
  const gridColor = theme.palette.divider;
  // 加载期间锁定页面滚动，避免出现多余的滚动条（固定遮罩已覆盖视口）
  // 同时锁定 <html> 和 <body>：很多浏览器的视口滚动条由 documentElement 控制
  useEffect(() => {
    if (!showGlobalControls) return undefined;
    if (loading) {
      const html = document.documentElement;
      const body = document.body;
      const prevHtml = html.style.overflow;
      const prevBody = body.style.overflow;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      return () => {
        html.style.overflow = prevHtml;
        body.style.overflow = prevBody;
      };
    }
    return undefined;
  }, [loading, showGlobalControls]);
  // 新增：hover时高亮同LotNo，以及filteredHistogramData
  const [hoveredLotNo, setHoveredLotNo] = useState(null);
  const [filteredStatistics, setFilteredStatistics] = useState(null);
  const [filteredHistogramData, setFilteredHistogramData] = useState([]);

  // 日期可选范围（年 / 月）
  const availableYears = React.useMemo(
    () => Array.from(new Set((availableDatesRaw || []).map(d => dayjs(d, 'MM/DD/YYYY').year()))),
    [availableDatesRaw]
  );
  const availableYearMonths = React.useMemo(
    () => new Set((availableDatesRaw || []).map(d => dayjs(d, 'MM/DD/YYYY').format('YYYY-MM'))),
    [availableDatesRaw]
  );

  const getSelectedDay = React.useCallback((value) => {
    if (!value) return null;
    const parsed = dayjs(value, 'MM/DD/YYYY');
    return parsed.isValid() ? parsed : null;
  }, []);

  const shouldDisableDateKeepSelected = React.useCallback((date, selectedValue) => {
    const selectedDay = getSelectedDay(selectedValue);
    if (selectedDay && date && dayjs(date).isSame(selectedDay, 'day')) return false;
    return !isDateAvailable(date);
  }, [getSelectedDay, isDateAvailable]);

  const shouldDisableYearKeepSelected = React.useCallback((year, selectedValue) => {
    const selectedDay = getSelectedDay(selectedValue);
    if (selectedDay && year?.year() === selectedDay.year()) return false;
    return !availableYears.includes(year.year());
  }, [availableYears, getSelectedDay]);

  const shouldDisableMonthKeepSelected = React.useCallback((month, selectedValue) => {
    const selectedDay = getSelectedDay(selectedValue);
    const monthKey = month.format('YYYY-MM');
    if (selectedDay && monthKey === selectedDay.format('YYYY-MM')) return false;
    return !availableYearMonths.has(monthKey);
  }, [availableYearMonths, getSelectedDay]);

  // 散点数据（必须在饼图统计之前定义）
  const scatterData = React.useMemo(() => {
    const arr = (data || [])
      .filter(item => {
        if (!dateRange[0] && !dateRange[1]) return true;
        const itemDateStr = dayjs(item.MeasDate).format('MM/DD/YYYY');
        if (dateRange[0] && dayjs(itemDateStr, 'MM/DD/YYYY').isBefore(dayjs(dateRange[0], 'MM/DD/YYYY'))) return false;
        if (dateRange[1] && dayjs(itemDateStr, 'MM/DD/YYYY').isAfter(dayjs(dateRange[1], 'MM/DD/YYYY'))) return false;
        return true;
      })
      .map((item, idx) => ({
        x: dayjs(item.MeasDate).format('YYYY-MM-DD'),
        xLabel: dayjs(item.MeasDate).format('MMM DD, YYYY'),
        y: item.MeasValue,
        fullDate: dayjs(item.MeasDate).format('YYYY-MM-DD'),
        rawDate: item.MeasDate,
        idx,
        LotNo: item.LotNo,
        SubSampleNo: item.SubSampleNo,
        CarbonizingFurnace: item.CarbonizingFurnace || 'Unknown',
        TemperingFurnace: item.TemperingFurnace || 'Unknown',
      }));
    return arr.sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
  }, [data, dateRange]);

  // 当isTimeSeries为true时，填充缺失的日期 - 基于月份范围
  const displayData = React.useMemo(() => {
    if (!isTimeSeries || !scatterData || scatterData.length === 0) {
      return scatterData;
    }
    
    try {
      const sorted = [...scatterData].sort((a, b) => 
        new Date(a.fullDate) - new Date(b.fullDate)
      );
      
      // 优先使用 startMonth/endMonth，否则使用数据范围
      let minDate, maxDate;
      
      if (startMonth && endMonth) {
        // 使用 filter 的月份范围
        minDate = dayjs(monthToBoundaryDateString(startMonth, 'start'), 'MM/DD/YYYY');
        maxDate = dayjs(monthToBoundaryDateString(endMonth, 'end'), 'MM/DD/YYYY');
        console.log('Gap Filling NC Scatter: Using filter month range', { 
          start: minDate.format('YYYY-MM-DD'),
          end: maxDate.format('YYYY-MM-DD'),
          dataPoints: sorted.length
        });
      } else {
        // Fallback: 使用数据的 min/max
        minDate = dayjs(sorted[0].fullDate);
        maxDate = dayjs(sorted[sorted.length - 1].fullDate);
        console.log('Gap Filling NC Scatter: Using data range (no filter provided)', { 
          start: minDate.format('YYYY-MM-DD'),
          end: maxDate.format('YYYY-MM-DD')
        });
      }
      
      // 用Map按日期分组，保留同一天的所有 subsample 点
      const dataMap = new Map();
      sorted.forEach(d => {
        const dateStr = dayjs(d.fullDate).format('YYYY-MM-DD');
        if (!dataMap.has(dateStr)) {
          dataMap.set(dateStr, []);
        }
        dataMap.get(dateStr).push(d);
      });
      
      const result = [];
      let currentDate = minDate;
      let filledCount = 0;
      
      while (!currentDate.isAfter(maxDate)) {
        const dateStr = currentDate.format('YYYY-MM-DD');
        
        if (dataMap.has(dateStr)) {
          result.push(...dataMap.get(dateStr));
        } else {
          // 填补缺失日期 - 用 null 表示无数据
          result.push({
            x: dateStr,
            xLabel: currentDate.format('MMM DD, YYYY'),
            y: null,
            fullDate: dateStr,
            idx: -1,
            LotNo: null,
            SubSampleNo: null,
            CarbonizingFurnace: null,
            TemperingFurnace: null
          });
          filledCount++;
        }
        currentDate = currentDate.add(1, 'day');
      }
      
      console.log('After NC Scatter Gap Filling:', {
        totalPoints: result.length,
        filledDays: filledCount,
        originalPoints: sorted.length
      });
      
      return result;
    } catch (error) {
      console.error('Error in NC displayData:', error);
      return scatterData;
    }
  }, [scatterData, isTimeSeries, startMonth, endMonth]);

  // 饼图统计 - 只统计 MeasValue 有效的行（y !== null），与 statistics No of Data 基准一致
  const validScatterData = React.useMemo(() => {
    return (scatterData || []).filter(item => item.y !== null && item.y !== undefined && !isNaN(parseFloat(item.y)));
  }, [scatterData]);

  const carbonizingStats = React.useMemo(() => {
    const map = {};
    validScatterData.forEach(item => {
      const key = item.CarbonizingFurnace || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [validScatterData]);

  const temperingStats = React.useMemo(() => {
    const map = {};
    validScatterData.forEach(item => {
      const key = item.TemperingFurnace || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [validScatterData]);

  const furnacePieDataSorted = React.useMemo(
    () =>
      carbonizingStats.map((item, idx) => ({
        ...item,
        label: `${item.label} - ${item.value}`,
        color: PIE_COLORS[idx % PIE_COLORS.length],
        rawLabel: item.label,
        colorIdx: idx,
      })),
    [carbonizingStats]
  );

  const temperingPieDataSorted = React.useMemo(
    () =>
      temperingStats.map((item, idx) => ({
        ...item,
        label: `${item.label} - ${item.value}`,
        color: PIE_COLORS_MC4[idx % PIE_COLORS_MC4.length],
        rawLabel: item.label,
        colorIdx: idx,
      })),
    [temperingStats]
  );

  // Helper: find first valid numeric LSL/USL in dataset (tolerate string numbers)
  const findValidNumber = React.useCallback((val) => {
    if (val === null || val === undefined) return null;
    const n = Number(val);
    if (Number.isNaN(n)) return null;
    // Use same sentinel logic as prior code: treat very small (< -999) or very large (> 999) as invalid
    if (n < -999 || n > 999) return null;
    return n;
  }, []);

  const yValues = React.useMemo(() => scatterData.map(item => Number(item.y)).filter(v => !isNaN(v)), [scatterData]);

  // 新增：当选择pie或日期range时，调用后端计算新的statistics和histogram数据
  useEffect(() => {
    const calculateFilteredMetrics = async () => {
      // 根据是否选择furnace来决定用哪个数据集
      let dataToAnalyze = scatterData.map(item => ({ 
        LotNo: item.LotNo, 
        y: item.y,
        fullDate: item.fullDate
      }));

      if (clickedFurnace) {
        // 如果选了furnace，在scatterData基础上再按furnace过滤
        dataToAnalyze = dataToAnalyze.filter(item => {
          const originalItem = data.find(d => d.LotNo === item.LotNo && dayjs(d.MeasDate).format('MMM DD, YYYY') === dayjs(item.fullDate).format('MMM DD, YYYY'));
          if (!originalItem) return false;
          if (clickedFurnace.type === 'MC2') {
            return originalItem.CarbonizingFurnace === clickedFurnace.label;
          } else if (clickedFurnace.type === 'MC4') {
            return originalItem.TemperingFurnace === clickedFurnace.label;
          }
          return true;
        });
      }

      // 提取MeasValue并调用后端endpoint（过滤掉无效y行）
      const validDataToAnalyze = dataToAnalyze.filter(item => 
        item.y !== null && item.y !== undefined && !isNaN(parseFloat(item.y))
      );
      const subsampleData = validDataToAnalyze.map(item => 
        ({ LotNo: item.LotNo, Value: parseFloat(item.y)}));
      const lsl = data.length > 0 ? data[0].LSL : null;
      const usl = data.length > 0 ? data[0].USL : null;

      if (subsampleData.length === 0 || lsl === null || usl === null) {
        setFilteredStatistics(null);
        setFilteredHistogramData([]);
        return;
      }

      try {
        const response = await axios.post(`${window.baseURL}/subsamples/calculate-subsample-metrics`, {
          SubsampleData: JSON.stringify(subsampleData),
          LSL: findValidNumber(lsl),
          USL: findValidNumber(usl),
        });
        setFilteredStatistics(response.data?.statisticsValue || response.data || null);
        console.log('Filtered Statistics:', response.data);
        
        // 只有选了furnace时才设置filteredHistogramData
        if (clickedFurnace) {
          setFilteredHistogramData(subsampleData);
        } else {
          setFilteredHistogramData([]);
        }
      } catch (error) {
        console.error('Error calculating filtered metrics:', error);
        setFilteredStatistics(null);
        setFilteredHistogramData([]);
      }
    };

    calculateFilteredMetrics();
  }, [clickedFurnace, dateRange, data, scatterData, findValidNumber]);

  // 新增：计算histogram用的yValues（如果选了furnace且有filteredHistogramData，则用filtered数据）
  const histogramYValues = React.useMemo(() => {
    if (clickedFurnace && filteredHistogramData.length > 0) {
      return filteredHistogramData.map(item => Number(item.Value)).filter(v => !isNaN(v));
    }
    return yValues;
  }, [yValues, clickedFurnace, filteredHistogramData]);

  // Histogram bin配置（基于histogramYValues）
  const { binWidth, xMin, xMax } = React.useMemo(() => {
    if (!histogramYValues || histogramYValues.length < 3) return { binWidth: 1, xMin: 0, xMax: 1 };
    
    const mean = d3.mean(histogramYValues);
    const std = d3.deviation(histogramYValues);
    const min = Math.min(...histogramYValues);
    const max = Math.max(...histogramYValues);
    
    // 1. 扩展 X 轴范围 (仿 Minitab 效果)
    const displayMin = Math.min(min, mean - 4 * std);
    const displayMax = Math.max(max, mean + 4 * std);
    
    const binCount = Math.ceil((Math.log2(histogramYValues.length) + 1) * 2);
    const width = (max - min) / binCount;
    
    return { binWidth: width, xMin: displayMin, xMax: displayMax };
  }, [histogramYValues]);

  // Find LSL/USL robustly (scan data, not only first element)
  const LSL = React.useMemo(() => {
    if (!data || data.length === 0) return null;
    for (let i = 0; i < data.length; i += 1) {
      const n = findValidNumber(data[i].LSL);
      if (n !== null) return n;
    }
    return null;
  }, [data, findValidNumber]);

  const USL = React.useMemo(() => {
    if (!data || data.length === 0) return null;
    for (let i = 0; i < data.length; i += 1) {
      const n = findValidNumber(data[i].USL);
      if (n !== null) return n;
    }
    return null;
  }, [data, findValidNumber]);

  // 基于全部数据计算固定的Y轴范围（不受日期过滤或furnace选择影响）
  const [fixedYMinPad, fixedYMaxPad] = React.useMemo(() => {
    // 使用allDataForGlobalRange计算全局范围
    const globalData = allDataForGlobalRange && allDataForGlobalRange.length > 0 
      ? allDataForGlobalRange 
      : data;
    const globalYValues = globalData.map(item => Number(item.MeasValue)).filter(v => !isNaN(v));
    
    if (!globalYValues.length) {
      const fallbackMin = (LSL !== null) ? LSL : 0;
      const fallbackMax = (USL !== null) ? USL : fallbackMin + 1;
      const padding = Math.abs(fallbackMax - fallbackMin) * 0.1 || 1;
      return [fallbackMin - padding, fallbackMax + padding];
    }
    let min = Math.min(...globalYValues);
    let max = Math.max(...globalYValues);
    if (LSL !== null && Number.isFinite(LSL)) {
      min = Math.min(min, LSL);
      max = Math.max(max, LSL);
    }
    if (USL !== null && Number.isFinite(USL)) {
      min = Math.min(min, USL);
      max = Math.max(max, USL);
    }
    const padding = (max - min) * 0.1 || 1;
    return [min - padding, max + padding];
  }, [allDataForGlobalRange, data, LSL, USL]);

  // Hover 竖线
  const verticalLineShape = React.useMemo(() => {
    if (!hoveredX) return [];
    return [
      {
        type: 'line',
        xref: 'x',
        x0: hoveredX,
        x1: hoveredX,
        yref: 'y',
        y0: fixedYMinPad,
        y1: fixedYMaxPad,
        line: { color: '#666', width: 1, dash: 'dot' },
      },
    ];
  }, [hoveredX, fixedYMinPad, fixedYMaxPad]);

  // 均匀抽样一些 X 轴刻度，避免太挤
  const getSparseTicks = React.useCallback((ticks) => {
    const arr = ticks || [];
    if (arr.length <= 12) return arr;
    const step = Math.ceil(arr.length / 12);
    return arr.filter((_, i) => i % step === 0);
  }, []);

  // isTimeSeries 时只显示每月1号的 tick label
  const monthFirstTickPairs = React.useMemo(() => {
    if (!isTimeSeries || !displayData || displayData.length === 0) return null;
    const allVals = displayData.map(item => item.x);
    const allTexts = displayData.map(item => item.xLabel ?? item.x);
    const monthFirstSet = new Set();
    allVals.forEach(v => {
      const parsed = dayjs(v, 'YYYY-MM-DD', true);
      if (parsed.isValid() && parsed.date() === 1) monthFirstSet.add(v);
    });
    if (monthFirstSet.size === 0) return null;
    return {
      tickvals: allVals,
      ticktext: allVals.map((v, i) => monthFirstSet.has(v) ? allTexts[i] : ''),
    };
  }, [isTimeSeries, displayData]);

  // 颜色
  const scatterColors = React.useMemo(() => {
    return scatterData.map(item => {
      if (!clickedFurnace) return DEFAULT_DOT_COLOR;
      let match = false;
      if (clickedFurnace.type === 'MC2') {
        match = item.CarbonizingFurnace === clickedFurnace.label;
      } else if (clickedFurnace.type === 'MC4') {
        match = item.TemperingFurnace === clickedFurnace.label;
      }
      return match ? clickedFurnace.color : UNMATCHED_DOT_COLOR;
    });
  }, [scatterData, clickedFurnace]);

  // 新增：hover时同LotNo点发光，利用marker.line和size变化
  const scatterMarker = React.useMemo(() => {
    if (hoveredLotNo) {
      return {
        color: scatterColors,
        size: scatterData.map((item) =>
          item.LotNo === hoveredLotNo ? 14 : 8  // 同LotNo的点变大
        ),
        line: scatterData.map((item) =>
          item.LotNo === hoveredLotNo
            ? { width: 8, color: '#FFD700' }  // 金色发光边框
            : { width: 0, color: 'rgba(0,0,0,0)' }
        )
      };
    }
    return {
      color: scatterColors,
      size: 8,
      line: { width: 0, color: 'rgba(0,0,0,0)' }
    };
  }, [scatterColors, scatterData, hoveredLotNo]);

  // 为displayData创建marker（处理gap filled的数据）
  const displayMarker = React.useMemo(() => {
    const colors = displayData.map((item) => {
      if (item.idx === -1) return 'rgba(200,200,200,0.3)'; // gap filled点用灰色
      if (clickedFurnace) {
        let match = false;
        if (clickedFurnace.type === 'MC2') {
          match = item.CarbonizingFurnace === clickedFurnace.label;
        } else if (clickedFurnace.type === 'MC4') {
          match = item.TemperingFurnace === clickedFurnace.label;
        }
        return match ? clickedFurnace.color : UNMATCHED_DOT_COLOR;
      }
      return DEFAULT_DOT_COLOR;
    });

    if (hoveredLotNo) {
      return {
        color: colors,
        size: displayData.map((item) =>
          item.LotNo === hoveredLotNo ? 14 : 8
        ),
        line: displayData.map((item) =>
          item.LotNo === hoveredLotNo
            ? { width: 8, color: '#FFD700' }
            : { width: 0, color: 'rgba(0,0,0,0)' }
        )
      };
    }
    return {
      color: colors,
      size: 8,
      line: { width: 0, color: 'rgba(0,0,0,0)' }
    };
  }, [displayData, clickedFurnace, hoveredLotNo]);

  // 概要信息
  const first = (data && data.length > 0) ? data[0] : null;
  const summary = React.useMemo(() => {
    if (title && title.includes('HRA')) return hraSummary || null;
    if (title && title.includes('HRC')) return hrcSummary || null;
    return null;
  }, [title, hraSummary, hrcSummary]);

  const [popupOpen, setPopupOpen] = useState(false);
  const [popupData, setPopupData] = useState([]);
  const [popupTitle, setPopupTitle] = useState('');

  const handleOpenPopup = (dataset, title) => {
    setPopupData(dataset);
    setPopupTitle(title);
    setPopupOpen(true);
  };
  const handleClosePopup = () => setPopupOpen(false);

  // loading bar state
  const [progress, setProgress] = React.useState(0);
  React.useEffect(() => {
    if (!loading) {
      setProgress(0);
      return;
    }
    setProgress(0);
    let percent = 0;
    const interval = setInterval(() => {
      percent += Math.random() * 10 + 5; // simulate progress
      if (percent >= 90) percent = 90;
      setProgress(percent);
    }, 200);
    return () => clearInterval(interval);
  }, [loading]);

  React.useEffect(() => {
    if (!loading && progress > 0) {
      // finish bar
      setProgress(100);
      const timeout = setTimeout(() => setProgress(0), 500);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  // 统计区展示内容 - 简化为与 SubsampleScatterDistribution 相同的逻辑
  const statisticsToShow = React.useMemo(() => {
    // 如果有计算过的statistics（从furnace选择或dateRange更新），就用它
    if (filteredStatistics) {
      return filteredStatistics;
    }
    // 否则用初始的statistics值
    return initialStatisticsValue || {};
  }, [filteredStatistics, initialStatisticsValue]);

  // 计算skewness
  const skewness = React.useMemo(() => {
    if (!yValues || yValues.length < 3) return null;
    const n = yValues.length;
    const mean = d3.mean(yValues);
    const std = d3.deviation(yValues);
    if (!std || std === 0) return null;
    const m3 = d3.mean(yValues.map(v => Math.pow(v - mean, 3)));
    return ((n / ((n - 1) * (n - 2))) * (m3 / Math.pow(std, 3))).toFixed(3);
  }, [yValues]);

  // 获取General Info（first row）
  const generalInfo = first || {};

  // 弹窗导出按钮表头，前面加General Info字段
  const popupHeaders = [
    'Dept',
    'MachineId',
    'MaterialDesc',
    'DimensionDesc',
    'CAT',
    'LotNo',
    'SubSampleNo',
    'CarbonizingFurnace',
    'TemperingFurnace',
    'MeasValue',
    'MeasDate'
  ];

  // 遵循 SubsampleScatterDistribution 的逻辑：raw data 仅按日期过滤和无效值过滤，不受 furnace 选择影响
  const rawActionRows = React.useMemo(() => {
    return (data || []).filter(row => {
      const value = parseFloat(row.MeasValue);
      if (row.MeasValue === null || row.MeasValue === undefined || isNaN(value)) {
        return false;
      }

      const itemDateStr = dayjs(row.MeasDate).format('MM/DD/YYYY');
      if (dateRange[0] && dayjs(itemDateStr, 'MM/DD/YYYY').isBefore(dayjs(dateRange[0], 'MM/DD/YYYY'))) {
        return false;
      }
      if (dateRange[1] && dayjs(itemDateStr, 'MM/DD/YYYY').isAfter(dayjs(dateRange[1], 'MM/DD/YYYY'))) {
        return false;
      }

      // 不按 furnace 过滤 - raw data 应该保持完整，furnace 过滤仅用于计算 statistics
      return true;
    });
  }, [data, dateRange]);

  // 组装导出数据，每行都加General Info字段，和 popup 完全使用同一批 raw rows
  const exportData = rawActionRows.map(row => ({
    Dept: generalInfo.Dept ?? '',
    MachineId: generalInfo.MachineId ?? '',
    MaterialDesc: generalInfo.MaterialDesc ?? '',
    DimensionDesc: generalInfo.DimensionDesc ?? '',
    CAT: generalInfo.CAT ?? '',
    LotNo: row.LotNo,
    SubSampleNo: row.SubSampleNo,
    CarbonizingFurnace: row.CarbonizingFurnace,
    TemperingFurnace: row.TemperingFurnace,
    MeasValue: row.MeasValue,
    MeasDate: row.MeasDate
  }));

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', position: 'relative', mt: 2 }}>
      {/* 局部 loading bar，仅遮盖本组件内容，不遮盖全局菜单栏 */}
      {loading && createPortal(
        <Box sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 20000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#121212',
        }}>
          <Box sx={{
            width: 400,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 6,
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Loading...</Typography>
            <Box sx={{ width: '100%' }}>
              <Slider
                value={progress}
                min={0}
                max={100}
                disabled
                sx={{
                  color: '#1976d2',
                  height: 12,
                  '& .MuiSlider-thumb': { display: 'none' },
                  '& .MuiSlider-track': { border: 'none' },
                  '& .MuiSlider-rail': { opacity: 0.3 },
                }}
              />
            </Box>
            <Typography variant="body1" sx={{ fontSize: 22, fontWeight: 700 }}>{Math.round(progress)}%</Typography>
          </Box>
        </Box>,
        document.body
      )}
      <Grid container
        sx={{ minWidth: 0, width: '100%', maxWidth: '100vw', px: 1.5, boxSizing: 'border-box', overflow: 'hidden', filter: loading ? 'blur(2px)' : 'none', pointerEvents: loading ? 'none' : 'auto' }}>
        {/* 顶部：Slider + Date Range 同一行（仅在 showGlobalControls=true 时显示） */}
        {showGlobalControls && (
          <Grid item xs={12} md={12} sx={{ width: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 1,
                p: 1.5,
                mb: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                width: '100%',
                boxSizing: 'border-box',
              }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
            {/* Slider（range filter）排在 date picker 之后：order 2 */}
            <Box sx={{ width: '100%', position: 'relative', px: 3, pb: 1, order: 2 }}>
              {/* 顶部两端日期标签 */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  pointerEvents: 'none',
                  height: 10,
                  alignItems: 'flex-end',
                }}
              >
                <Typography variant="body1" sx={{ fontSize: 13, color: 'white', ml: '6px', mb: '-66px' }}>
                  {sliderDatesDisplay[minSlider]}
                </Typography>
                <Typography variant="body1" sx={{ fontSize: 13, color: 'white', mr: '6px', mb: '-66px' }}>
                  {sliderDatesDisplay[maxSlider]}
                </Typography>
              </Box>
              <Slider
                value={safeSliderValue}
                min={minSlider}
                max={maxSlider}
                step={1}
                onChange={(_, newValue) => {
                  if (Array.isArray(newValue)) {
                    const startIdx = Math.max(minSlider, Math.min(maxSlider, newValue[0]));
                    const endIdx = Math.max(minSlider, Math.min(maxSlider, newValue[1]));
                    setDateRange([sliderDatesRaw[startIdx], sliderDatesRaw[endIdx]]);
                  }
                }}
                valueLabelDisplay="auto"
                valueLabelFormat={idx => sliderDatesDisplay[idx] ?? ''}
                sx={{
                  width: '100%',
                  mt: 2,
                  mb: 2,
                  height: 12,
                  '& .MuiSlider-thumb': {
                    width: 32,
                    height: 32,
                  },
                  '& .MuiSlider-valueLabel': {
                    fontSize: 13,
                    background: '#13133F',
                    color: 'white',
                    borderRadius: 2,
                    px: 2,
                    py: 1,
                  },
                }}
                disabled={sliderDatesRaw.length < 2}
              />
            </Box>

            {/* Date Range（date picker module）排在 range filter 之前：order 1 */}
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 1, order: 1 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Date Range:</Typography>
                <DatePicker
                  label="Start Date"
                  views={['year', 'month', 'day']}
                  value={dateRange[0] ? dayjs(dateRange[0], 'MM/DD/YYYY') : null}
                  onChange={val => setDateRange([val ? val.format('MM/DD/YYYY') : null, dateRange[1]])}
                  shouldDisableDate={date => shouldDisableDateKeepSelected(date, dateRange[0])}
                  shouldDisableYear={year => shouldDisableYearKeepSelected(year, dateRange[0])}
                  shouldDisableMonth={month => shouldDisableMonthKeepSelected(month, dateRange[0])}
                  format="MMM DD, YYYY"
                  slotProps={{ textField: { sx: { minWidth: 160 } } }}
                  closeOnSelect
                />
                <Typography variant="h6" sx={{ whiteSpace: 'nowrap' }}>to</Typography>
                <DatePicker
                  label="End Date"
                  views={['year', 'month', 'day']}
                  value={dateRange[1] ? dayjs(dateRange[1], 'MM/DD/YYYY') : null}
                  onChange={val => setDateRange([dateRange[0], val ? val.format('MM/DD/YYYY') : null])}
                  shouldDisableDate={date => shouldDisableDateKeepSelected(date, dateRange[1])}
                  shouldDisableYear={year => shouldDisableYearKeepSelected(year, dateRange[1])}
                  shouldDisableMonth={month => shouldDisableMonthKeepSelected(month, dateRange[1])}
                  format="MMM DD, YYYY"
                  slotProps={{ textField: { sx: { minWidth: 160 } } }}
                  closeOnSelect
                />
                <Button
                  variant="outlined"
                  sx={{ ml: 1, fontSize: 14, px: 2.5, whiteSpace: 'nowrap' }}
                  onClick={() => setDateRange([null, null])}
                >
                  Clear
                </Button>
              </Box>
            </LocalizationProvider>
            </Box>
          </Grid>
        )}

        {/* 内容卡片：图表 + 信息区包裹在统一卡片中 */}
        <Grid item xs={12} sx={{ width: '100%' }}>
          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', p: 2, width: '100%', boxSizing: 'border-box' }}>
            {(!data || data.length === 0) ? (
              <Box sx={{ width: '100%', minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, py: 4 }}>
                <Typography variant="h6" sx={{ color: 'text.secondary' }}>No data for the selected range</Typography>
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>Adjust the date range or filters to load measurements.</Typography>
              </Box>
            ) : (
            <Grid container spacing={2}>
        {/* 左侧图表区 */}
        <Grid
          item
          xs={12}
          md={8}
          sx={{
            minWidth: 0,
            width: '100%',
            maxWidth: '100%',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
          }}
        >
          <Box sx={{ width: '100%' }}>
            <PlotlyComponent
              data={[
                // Scatter plot (左侧)
                {
                  x: displayData.map(item => item.x),
                  y: displayData.map(item => item.y),
                  mode: 'markers',
                  type: 'scatter',
                  name: 'Scatter',
                  marker: displayMarker,
                  xaxis: 'x',
                  yaxis: 'y',
                  text: displayData.map(item =>
                    item.idx === -1
                      ? `<b>No Data</b><br>Date: ${item.xLabel ?? item.x}`
                      : `<b>LotNo: ${item.LotNo ?? '-'}</b><br>` +
                        `SubSampleNo: ${item.SubSampleNo ?? '-'}<br>` +
                    `CarbonizingFurnace: ${item.CarbonizingFurnace ?? '-'}<br>` +
                    `TemperingFurnace: ${item.TemperingFurnace ?? '-'}<br>` +
                    `MeasValue: ${item.y ?? '-'}<br>` +
                    `Date: ${item.xLabel ?? '-'}<br>` +
                    `<i>Click to view Individual Lot Distribution</i>`
                  ),
                  hovertemplate:
                    '%{text}<extra></extra>',
                  hoverinfo: 'text',
                  customdata: displayData.map(item => item.LotNo),
                },
                // Histogram (右侧，横向条形，X轴为count，Y轴为MeasValue)
                {
                  y: histogramYValues,
                  type: 'histogram',
                  orientation: 'h', // 横向
                  name: 'Histogram',
                  marker: {
                    color: clickedFurnace ? clickedFurnace.color : 'rgba(0,0,255,0.4)',
                    line: { color: 'white', width: 2 },
                  },
                  opacity: 0.7,
                  xaxis: 'x2',
                  yaxis: 'y',
                  ybins: {
                    start: xMin,
                    end: xMax,
                    size: binWidth,
                  },
                },
              ]}
              layout={{
                grid: { rows: 1, columns: 2, pattern: 'independent' },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                font: { size: 15, color: axisTextColor },
                legend: { font: { size: 15 } },
                // 左侧：scatter
                xaxis: {
                  type: isTimeSeries ? 'date' : 'category',
                  domain: [0, 0.72],
                  ...(isTimeSeries && monthFirstTickPairs ? {
                    tickmode: 'array',
                    tickvals: monthFirstTickPairs.tickvals,
                    ticktext: monthFirstTickPairs.ticktext,
                  } : !isTimeSeries ? {
                    tickvals: getSparseTicks(displayData.map(item => item.x)),
                    ticktext: getSparseTicks(displayData.map(item => item.xLabel ?? item.x)),
                  } : {}),
                  tickangle: -45,
                  ticklabelposition: 'bottom',
                  showticklabels: true,
                  tickfont: { size: 14, color: axisTextColor },
                  gridcolor: gridColor,
                  zerolinecolor: gridColor,
                },
                yaxis: {
                  title: { text: 'MeasValue', font: { size: 16, color: axisTextColor } },
                  anchor: 'x',
                  domain: [0, 1],
                  range: [fixedYMinPad, fixedYMaxPad],
                  showticklabels: true,
                  fixedrange: true,
                  tickfont: { size: 14, color: axisTextColor },
                  gridcolor: gridColor,
                  zerolinecolor: gridColor,
                },
                // 右侧：histogram 共享Y轴
                xaxis2: {
                  title: { text: 'Count', font: { size: 20, color: axisTextColor } },
                  domain: [0.74, 1],
                  showticklabels: true,
                  titlefont: { size: 20, color: axisTextColor },
                  tickfont: { size: 20, color: axisTextColor },
                  gridcolor: gridColor,
                  zerolinecolor: gridColor,
                },
                width: undefined,
                height: CHART_HEIGHT,
                autosize: true,
                margin: { t: 40, l: 100, r: 120, b: 130 },
                shapes: [
                  ...(LSL !== null
                    ? [
                        {
                          type: 'line',
                          xref: 'paper',
                          x0: 0,
                          x1: 1,
                          y0: LSL,
                          y1: LSL,
                          yref: 'y',
                          line: { color: '#F54D41', width: 2, dash: 'dot' },
                        },
                      ]
                    : []),
                  ...(USL !== null
                    ? [
                        {
                          type: 'line',
                          xref: 'paper',
                          x0: 0,
                          x1: 1,
                          y0: USL,
                          y1: USL,
                          yref: 'y',
                          line: { color: '#F54D41', width: 2, dash: 'dot' },
                        },
                      ]
                    : []),
                  ...verticalLineShape,
                ],
                annotations: [
                  ...(LSL !== null
                    ? [
                        {
                          x: -0.04,
                          y: LSL,
                          xref: 'paper',
                          yref: 'y',
                          text: 'LSL',
                          showarrow: false,
                          font: { color: '#F54D41', size: 14 },
                        },
                      ]
                    : []),
                  ...(USL !== null
                    ? [
                        {
                          x: -0.04,
                          y: USL,
                          xref: 'paper',
                          yref: 'y',
                          text: 'USL',
                          showarrow: false,
                          font: { color: '#F54D41', size: 14 },
                        },
                      ]
                    : []),
                ],
                showlegend: false,
              }}
              style={{
                width: '100%',
                height: CHART_HEIGHT,
                minWidth: 0,
                maxWidth: '100%',
                margin: '0 auto',
                display: 'block',
              }}
              config={{ responsive: true, displayModeBar: false }}
              onHover={e => {
                if (e && e.points && e.points.length > 0) {
                  const pt = e.points[0];
                  if (pt.curveNumber === 0) {
                    setHoveredX(pt.x);
                    const lotNo = displayData[pt.pointIndex]?.LotNo;
                    setHoveredLotNo(lotNo || null);
                  }
                }
              }}
              onUnhover={() => {
                setHoveredX(null);
                setHoveredLotNo(null);
              }}
              onClick={e => {
                if (e && e.points && e.points.length > 0) {
                  const pt = e.points[0];
                  if (pt.curveNumber === 0) {  // scatter is curve 0
                    const clickedPoint = displayData[pt.pointIndex];
                    const lotNo = clickedPoint?.LotNo || null;
                    const moreDataPoint = data.find(item => (
                      item.LotNo === lotNo
                      && dayjs(item.MeasDate).format('YYYY-MM-DD') === clickedPoint?.fullDate
                    ));
                    if (lotNo && moreDataPoint) {
                      navigate('/lots-sample-distribution-table', {
                        state: {
                          row: moreDataPoint,
                          Period: moreDataPoint?.Period ? moreDataPoint.Period : null,
                          displayPP: false,
                        }
                      });
                      console.log('Navigating to Individual Lot Distribution page with state:', {
                        row: moreDataPoint,
                        Period: moreDataPoint?.Period ? moreDataPoint.Period : null,
                        displayPP: false,
                      });
                    }
                  }
                }
              }}
            />
            <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 2 }}>
              {/* BRD SC6: "Retrieve raw data" removed; keep only "Download Raw Data". */}
              <CsvExportButton
                data={exportData}
                headers={popupHeaders}
                filename={buildExportFilename(generalInfo.MaterialDesc, title && title.includes('HRA') ? 'HRA' : title && title.includes('HRC') ? 'HRC' : 'Subsample')}
                generalInfo={[
                  { label: 'Report', value: (title || 'Subsample') + ' Scattered Subsample Distribution' },
                  { label: 'Dept', value: generalInfo.Dept || '' },
                  { label: 'MachineId', value: generalInfo.MachineId || '' },
                  { label: 'MaterialDesc', value: generalInfo.MaterialDesc || '' },
                  { label: 'DimensionDesc', value: generalInfo.DimensionDesc || '' },
                  { label: 'CAT', value: generalInfo.CAT || '' },
                  { label: 'PP', value: statisticsToShow?.PPValue ?? '' },
                  { label: 'PPK', value: statisticsToShow?.PPKValue ?? '' },
                ]}
                sx={{ maxWidth: 400, fontSize: 22 }}
              >
                Download Raw Data
              </CsvExportButton>
            </Box>
          </Box>
        </Grid>

        {/* 右侧信息区 */}
        <Grid
          item
          xs={12}
          md={4}
          sx={{
            minWidth: 0,
            maxWidth: 500,
            pr: 4,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            height: '100%',
          }}
        >
          <Box>
            <Typography variant="h5" textAlign="center" gutterBottom>
              General Information
            </Typography>
            <Box sx={{ width: '100%' }} />
            <Grid container spacing={1}>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={5}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    Dept:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {first?.Dept ?? '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={5}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    MachineId:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {first?.MachineId ?? '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={3}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    MaterialDesc:
                  </Typography>
                </Grid>
                <Grid item xs={9}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {first?.MaterialDesc ?? '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={3}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    DimensionDesc:
                  </Typography>
                </Grid>
                <Grid item xs={9}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {first?.DimensionDesc ?? '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={5}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    CAT:
                  </Typography>
                </Grid>
                <Grid item xs={7}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {first?.CAT ?? '-'}
                  </Typography>
                </Grid>
              </Grid>
            </Grid>
          </Box>

          <Box mt={6}>
            <Typography variant="h5" textAlign="center" gutterBottom>
              Statistics
            </Typography>
            <Box sx={{ width: '100%'}} />
            <Grid container spacing={1}>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    No of Data:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {statisticsToShow.Count ?? data.length ?? '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    Mean:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {statisticsToShow.MeanValue !== undefined ? statisticsToShow.MeanValue : '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    StdDev:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {statisticsToShow.StdValue !== undefined ? Number(statisticsToShow.StdValue).toFixed(3) : '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    LSL:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {LSL !== null ? LSL : '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    USL:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {USL !== null ? USL : '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    PP:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold', color: metricColor(statisticsToShow.PPValue) }}>
                    {statisticsToShow.PPValue !== undefined ? statisticsToShow.PPValue : '-'}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs={12} alignItems="top">
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                    PPK:
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="h5" sx={{ textAlign: 'right', fontWeight: 'bold', color: metricColor(statisticsToShow.PPKValue) }}>
                    {statisticsToShow.PPKValue !== undefined ? statisticsToShow.PPKValue : '-'}
                  </Typography>
                </Grid>
              </Grid>
              {/* 炉次 summary 展示：MC2 & MC4 都展示 */}
              {first?.CarbonizingFurnaceSummary && (
                <Grid container item xs={12} alignItems="top">
                  <Grid item xs={6}>
                    <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                      Carbonizing Furnace Summary:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: 16 }}>
                      {Array.isArray(first.CarbonizingFurnaceSummary)
                        ? first.CarbonizingFurnaceSummary.map(f => `${f.Furnace}: ${f.Count}`).join(', ')
                        : '-'}
                    </Typography>
                  </Grid>
                </Grid>
              )}
              {first?.TemperingFurnaceSummary && (
                <Grid container item xs={12} alignItems="top">
                  <Grid item xs={6}>
                    <Typography variant="h5" sx={{ color: 'lightgrey', fontWeight: 'normal' }}>
                      Tempering Furnace Summary:
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="h6" sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: 16 }}>
                      {Array.isArray(first.TemperingFurnaceSummary)
                        ? first.TemperingFurnaceSummary.map(f => `${f.Furnace}: ${f.Count}`).join(', ')
                        : '-'}
                    </Typography>
                  </Grid>
                </Grid>
              )}
            </Grid>
          </Box>

          <Box mt={6}>
            <Typography variant="h5" textAlign="center" gutterBottom>
              Furnace Data
            </Typography>
            <Box sx={{ width: '100%', mb: 2 }} />
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box>
                <Typography variant="h6" textAlign="center" sx={{ mb: 1 }}>
                  Carburizing Furnace (TVC)
                </Typography>
                <PieChart
                  series={[
                    {
                      data: furnacePieDataSorted.length
                        ? furnacePieDataSorted
                        : [{ label: 'No Data', value: 1, color: 'rgba(148,163,184,0.18)', rawLabel: 'No Data' }],
                      arcLabelMinAngle: 10,
                      arcLabelRadius: '90%',
                      highlightScope: { faded: 'global', highlighted: 'item' },
                      cornerRadius: 6,
                      paddingAngle: 2,
                      innerRadius: 40,
                      outerRadius: 70,
                      cx: 90,
                      cy: 90,
                    },
                  ]}
                  sx={{
                    [`& .${pieArcLabelClasses.root}`]: {
                      fontWeight: 'bold',
                      fontSize: 13,
                      paintOrder: 'stroke',
                      stroke: '#222',
                      strokeWidth: 2,
                      textShadow: '0 2px 6px #fff, 0 0 2px #fff',
                    },
                  }}
                  slotProps={{ legend: { hidden: true } }}
                  width={180}
                  height={180}
                  onItemClick={(event, d) => {
                    const idx = d.dataIndex;
                    const pie = furnacePieDataSorted[idx];
                    if (!pie) return;
                    if (clickedFurnace && clickedFurnace.type === 'MC2' && clickedFurnace.label === pie.rawLabel) {
                      setClickedFurnace(null);
                    } else {
                      setClickedFurnace({
                        type: 'MC2',
                        label: pie.rawLabel,
                        color: pie.color,
                      });
                    }
                  }}
                />
              </Box>

              <Box>
                <Typography variant="h6" textAlign="center" sx={{ mb: 1 }}>
                  Tempering Furnace (TAT)
                </Typography>
                <PieChart
                  series={[
                    {
                      data: temperingPieDataSorted.length
                        ? temperingPieDataSorted
                        : [{ label: 'No Data', value: 1, color: 'rgba(148,163,184,0.18)', rawLabel: 'No Data' }],
                      arcLabelMinAngle: 10,
                      arcLabelRadius: '90%',
                      highlightScope: { faded: 'global', highlighted: 'item' },
                      cornerRadius: 6,
                      paddingAngle: 2,
                      innerRadius: 40,
                      outerRadius: 70,
                      cx: 90,
                      cy: 90,
                    },
                  ]}
                  onItemClick={(event, d) => {
                    const idx = d.dataIndex;
                    const pie = temperingPieDataSorted[idx];
                    if (!pie) return;
                    if (clickedFurnace && clickedFurnace.type === 'MC4' && clickedFurnace.label === pie.rawLabel) {
                      setClickedFurnace(null);
                    } else {
                      setClickedFurnace({
                        type: 'MC4',
                        label: pie.rawLabel,
                        color: pie.color,
                      });
                    }
                  }}
                  sx={{
                    [`& .${pieArcLabelClasses.root}`]: {
                      fontWeight: 'bold',
                      fontSize: 13,
                      paintOrder: 'stroke',
                      stroke: '#222',
                      strokeWidth: 2,
                      textShadow: '0 2px 6px #fff, 0 0 2px #fff',
                    },
                  }}
                  slotProps={{ legend: { hidden: true } }}
                  width={180}
                  height={180}
                />
              </Box>
            </Box>
          </Box>
        </Grid>
            </Grid>
            )}
          </Box>
        </Grid>
      </Grid>

      {/* Popup 展示所有数据 */}
      {popupOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            bgcolor: 'rgba(0,0,0,0.25)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={handleClosePopup}
        >
          <Box
            sx={{
              position: 'relative',
              width: '75vw',
              maxHeight: '80vh',
              bgcolor: 'background.paper',
              boxShadow: 24,
              borderRadius: 4,
              zIndex: 9999,
              p: 4,
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
            onClick={e => e.stopPropagation()}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{popupTitle}</Typography>
              <Button variant="outlined" sx={{ fontSize: 13, px: 3, py: 1 }} onClick={handleClosePopup}>Close</Button>
            </Box>
            {/* MUI Table with Ranking */}
            <Box sx={{ overflowX: 'auto' }}>
              <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
                <Table stickyHeader size="small" sx={{ minWidth: 700, fontSize: 15 }}>
                  <TableHead>
                    <TableRow sx={{ background: '#1a237e' }}>
                      <TableCell sx={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}></TableCell>
                      <TableCell sx={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}>LotNo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}>SubSampleNo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}>Carburizing Furnace</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}>Tempering Furnace</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}>MeasValue</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}>MeasDate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {popupData && popupData.length > 0 ? popupData.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontSize: 15 }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontSize: 15 }}>{item.LotNo ?? '-'}</TableCell>
                        <TableCell sx={{ fontSize: 15 }}>{item.SubSampleNo ?? '-'}</TableCell>
                        <TableCell sx={{ fontSize: 15 }}>{item.CarbonizingFurnace ?? '-'}</TableCell>
                        <TableCell sx={{ fontSize: 15 }}>{item.TemperingFurnace ?? '-'}</TableCell>
                        <TableCell sx={{ fontSize: 15 }}>{item.MeasValue ?? '-'}</TableCell>
                        <TableCell sx={{ fontSize: 15 }}>{dayjs(item.MeasDate).format('MMM DD, YYYY') ?? '-'}</TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 3, fontSize: 15 }}>
                          No data
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}

const NCSubsampleScatterBarChart = () => {
  const location = useLocation();
  const { state } = location || {};
  const { isTimeSeries } = useContext(TimeSeriesContext); // 从context读取时间序列标志
  console.log('Received state from navigation:', state);
  const { value, filters, source } = state || {};
  const defaultStartMonth = (() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const defaultEndMonth = (() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();
  const requestedStartMonth = normalizeMonthValue(state?.filters?.StartMonth) || defaultStartMonth;
  const requestedEndMonth = normalizeMonthValue(state?.filters?.EndMonth) || defaultEndMonth;
  const [pageFilters, setPageFilters] = useState({
    Dept: '',
    MachineId: '',
    MaterialDesc: '',
    DimensionDesc: '',
    CAT: [],
    StartMonth: '',
    EndMonth: '',
  });

  useEffect(() => {
    if (state && state.filters) {
      setPageFilters({
        ...state.filters,
        StartMonth: requestedStartMonth,
        EndMonth: requestedEndMonth,
      });
    } else {
      setPageFilters({ StartMonth: requestedStartMonth, EndMonth: requestedEndMonth });
    }
  }, [requestedEndMonth, requestedStartMonth, state]);

  
  // 避免每次渲染都变更 selectedData
  const selectedData = React.useMemo(
    () => ({
      ...(pageFilters || {}),
      ...(filters || {}),
      [source || 'Selected']: value,
    }),
    [pageFilters, filters, source, value]
  );

  const [allData, setAllData] = useState([]);
  const [hraData, setHraData] = useState([]);
  const [hrcData, setHrcData] = useState([]);
  const [hraSummary, setHraSummary] = useState(null);
  const [hrcSummary, setHrcSummary] = useState(null);
  const [initialStatisticsValue, setInitialStatisticsValue] = useState({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(() => [
    monthToBoundaryDateString(requestedStartMonth, 'start'),
    monthToBoundaryDateString(requestedEndMonth, 'end'),
  ]);
  const [hoveredX, setHoveredX] = useState(null);
  const [clickedFurnace, setClickedFurnace] = useState(null);

  useEffect(() => {
    setDateRange([
      monthToBoundaryDateString(requestedStartMonth, 'start'),
      monthToBoundaryDateString(requestedEndMonth, 'end'),
    ]);
  }, [requestedStartMonth, requestedEndMonth]);

  const availableDatesRaw = React.useMemo(
    () =>
      Array.from(new Set(allData.map(item => dayjs(item.MeasDate).format('MM/DD/YYYY')))).sort(
        (a, b) => dayjs(a, 'MM/DD/YYYY').valueOf() - dayjs(b, 'MM/DD/YYYY').valueOf()
      ),
    [allData]
  );

  const sliderDatesRaw = React.useMemo(() => {
    if (!isTimeSeries) {
      return availableDatesRaw;
    }

    const fallbackStart = availableDatesRaw[0] ?? null;
    const fallbackEnd = availableDatesRaw[availableDatesRaw.length - 1] ?? null;
    const sliderStartDate = monthToBoundaryDateString(requestedStartMonth, 'start') ?? fallbackStart;
    const sliderEndDate = monthToBoundaryDateString(requestedEndMonth, 'end') ?? fallbackEnd;
    const continuousDates = buildContinuousDateRange(sliderStartDate, sliderEndDate);

    return continuousDates.length > 0 ? continuousDates : availableDatesRaw;
  }, [availableDatesRaw, requestedEndMonth, requestedStartMonth, isTimeSeries]);

  const sliderDatesDisplay = React.useMemo(
    () => sliderDatesRaw.map(d => dayjs(d, 'MM/DD/YYYY').format('MMM DD, YYYY')),
    [sliderDatesRaw]
  );

  const isDateAvailable = date => {
    if (!date) return false;
    const dstr = dayjs(date).format('MM/DD/YYYY');
    return availableDatesRaw.includes(dstr);
  };

  const minSlider = 0;
  const maxSlider = sliderDatesRaw.length > 0 ? sliderDatesRaw.length - 1 : 0;

  const sliderValue = [
    dateRange[0] ? sliderDatesRaw.indexOf(dayjs(dateRange[0], 'MM/DD/YYYY').format('MM/DD/YYYY')) : minSlider,
    dateRange[1] ? sliderDatesRaw.indexOf(dayjs(dateRange[1], 'MM/DD/YYYY').format('MM/DD/YYYY')) : maxSlider,
  ];
  const safeSliderValue = [
    sliderValue[0] < 0 ? minSlider : sliderValue[0],
    sliderValue[1] < 0 ? maxSlider : sliderValue[1],
  ];

  useEffect(() => {
    if (!selectedData || Object.values(selectedData).every(v => !v)) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${window.baseURL}/subsamples/nc-all`, {
          params: {
            Dept: selectedData.Dept,
            MachineId: selectedData.MachineId,
            MaterialDesc: selectedData.MaterialDesc,
            DimensionDesc: selectedData.DimensionDesc,
            CAT: selectedData.CAT,
            StartMonth: requestedStartMonth,
            EndMonth: requestedEndMonth,
          },
        });
        if (cancelled) return;

        console.log('Fetched data:', response.data);
        // 兼容大小写 + 汇总 + 统计数据
        const resp = response.data || {};
        const hra = Array.isArray(resp.HRA) ? resp.HRA : (Array.isArray(resp.hra) ? resp.hra : null);
        const hrc = Array.isArray(resp.HRC) ? resp.HRC : (Array.isArray(resp.hrc) ? resp.hrc : null);
        const hraSummary = resp.hraData || resp.HRAData || null;
        const hrcSummary = resp.hrcData || resp.HRCData || null;
        const statisticsValue = resp.statisticsValue || {};
        console.log('Fetched Statistics Value:', statisticsValue);

        if (hra || hrc) {
          setHraData(hra || []);
          setHrcData(hrc || []);
          setAllData([...(hra || []), ...(hrc || [])]);
          setHraSummary(hraSummary);
          setHrcSummary(hrcSummary);
          setInitialStatisticsValue(statisticsValue);
        } else if (Array.isArray(resp)) {
          setAllData(resp);
          // 自动分割 HRA 和 HRC 数据给饼图使用
          const respHraData = resp.filter(item => item.DimensionDesc && item.DimensionDesc.includes('HRA'));
          const respHrcData = resp.filter(item => item.DimensionDesc && item.DimensionDesc.includes('HRC'));
          setHraData(respHraData.length > 0 ? respHraData : []);
          setHrcData(respHrcData.length > 0 ? respHrcData : []);
          setHraSummary(null);
          setHrcSummary(null);
          setInitialStatisticsValue(statisticsValue);
        } else {
          setAllData([]);
          setHraData([]);
          setHrcData([]);
          setHraSummary(null);
          setHrcSummary(null);
          setInitialStatisticsValue({});
        }
      } catch (error) {
        if (cancelled) return;
        setAllData([]);
        setHraData([]);
        setHrcData([]);
        setLoading(false);
        if (!window.__ncsubsample_error_reported) {
          window.__ncsubsample_error_reported = true;
          console.error('Error fetching data:', error);
        }
        return;
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [requestedEndMonth, requestedStartMonth, selectedData, pageFilters]);

  // 渲染
  const showDouble = hraData.length > 0 && hrcData.length > 0;

  if (showDouble) {
    // 移除 scale 样式，保证内容宽度100%，自适应父容器
    return (
      <Box sx={{ width: '100%' }}>
          <Typography variant="h4" gutterBottom sx={{ mt: 2, mb: 0}}>
            Subsample Scatter Distribution
          </Typography>
        <ChartBlock
          data={hraData}
          title="HRA Scatter Distribution"
          dateRange={dateRange}
          setDateRange={setDateRange}
          availableDatesRaw={availableDatesRaw}
          sliderDatesRaw={sliderDatesRaw}
          sliderDatesDisplay={sliderDatesDisplay}
          minSlider={minSlider}
          maxSlider={maxSlider}
          safeSliderValue={safeSliderValue}
          isDateAvailable={isDateAvailable}
          hoveredX={hoveredX}
          setHoveredX={setHoveredX}
          loading={loading}
          clickedFurnace={clickedFurnace}
          setClickedFurnace={setClickedFurnace}
          pieHRAData={hraData}
          pieHRCData={hrcData}
          hraSummary={hraSummary}
          hrcSummary={hrcSummary}
          initialStatisticsValue={initialStatisticsValue}
          showGlobalControls={true}
          allDataForGlobalRange={hraData}
          isTimeSeries={isTimeSeries}
          startMonth={requestedStartMonth}
          endMonth={requestedEndMonth}
        />
        <ChartBlock
          data={hrcData}
          title="HRC Scatter Distribution"
          dateRange={dateRange}
          setDateRange={setDateRange}
          availableDatesRaw={availableDatesRaw}
          sliderDatesRaw={sliderDatesRaw}
          sliderDatesDisplay={sliderDatesDisplay}
          minSlider={minSlider}
          maxSlider={maxSlider}
          safeSliderValue={safeSliderValue}
          isDateAvailable={isDateAvailable}
          hoveredX={hoveredX}
          setHoveredX={setHoveredX}
          loading={loading}
          clickedFurnace={clickedFurnace}
          setClickedFurnace={setClickedFurnace}
          pieHRAData={hraData}
          pieHRCData={hrcData}
          hraSummary={hraSummary}
          hrcSummary={hrcSummary}
          initialStatisticsValue={initialStatisticsValue}
          showGlobalControls={false}
          allDataForGlobalRange={hrcData}
          isTimeSeries={isTimeSeries}
          startMonth={requestedStartMonth}
          endMonth={requestedEndMonth}
        />
      </Box>
    );
  } else {
    // 单图场景（All / Subsample），显示顶部控件
    return (
      <>
        <ChartBlock
          data={allData}
          title="Subsample Scatter Distribution"
          dateRange={dateRange}
          setDateRange={setDateRange}
          availableDatesRaw={availableDatesRaw}
          sliderDatesRaw={sliderDatesRaw}
          sliderDatesDisplay={sliderDatesDisplay}
          minSlider={minSlider}
          maxSlider={maxSlider}
          safeSliderValue={safeSliderValue}
          isDateAvailable={isDateAvailable}
          hoveredX={hoveredX}
          setHoveredX={setHoveredX}
          loading={loading}
          clickedFurnace={clickedFurnace}
          setClickedFurnace={setClickedFurnace}
          // 饼图来源：只有 allData 时，两个饼图可能都显示 No Data
          pieHRAData={hraData}
          pieHRCData={hrcData}
          hraSummary={hraSummary}
          hrcSummary={hrcSummary}
          initialStatisticsValue={initialStatisticsValue}
          showGlobalControls={true}
          allDataForGlobalRange={allData}
          isTimeSeries={isTimeSeries}
          startMonth={requestedStartMonth}
          endMonth={requestedEndMonth}
        />
      </>
    );
  }
};

export default NCSubsampleScatterBarChart;
//宝子我真的人麻了，我需要这变得pie 跟着后端传过来得raw data matching