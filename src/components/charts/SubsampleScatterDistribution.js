import React, { useEffect, useState, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import useDrilldownNavigate from '../../utils/useDrilldownNavigate';
import { useTheme } from '@mui/material/styles';
import { Typography, Grid, CircularProgress, Button, Stack, TextField, InputAdornment, Popover, Tooltip, IconButton, Divider } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import Slider from '@mui/material/Slider';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import axios from 'axios';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import { PieChart } from '@mui/x-charts/PieChart';
import * as d3 from 'd3-array';
import CsvExportButton from '../CsvExportButton';
import LotCPKBarChart from './LotCPKBarChart';
import { TimeSeriesContext } from '../../context/TimeSeriesContext';

const PlotlyComponent = createPlotlyComponent(Plotly);
// (SLIDER_WIDTH floor removed — layout is now fluid/responsive)
const CHART_HEIGHT = 650;
const AXIS_TICK_FONT_SIZE = 16;
const AXIS_TITLE_FONT_SIZE = 16;
const X_AXIS_TICK_LABEL_FONT_SIZE = 20;
const X_AXIS_TITLE_FONT_SIZE = 20;

const PIE_COLORS = [
  '#4FC3F7', '#81C784', '#FFD54F', '#FF8A65', '#BA68C8', '#F06292', '#FFF176', '#AED581', '#9575CD', '#64B5F6'
];
const PIE_COLORS_MC4 = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28CFF', '#FF6699', '#FFB347', '#B6FFB3', '#FF6666', '#66B3FF',
  '#FFB6C1', '#B3B6FF', '#FFD700', '#B3FFD9', '#FF8C00', '#8CFF8C', '#8C8CFF', '#FF8CB3', '#B3FF8C', '#8CB3FF'
];

const DEFAULT_DOT_COLOR = '#4F9EF8'; // bright blue — visible on the dark chart background

// Capability-metric colour: green above the 0.9949 threshold (a Cpk that rounds to
// ≥ 1.00), red at/below it, neutral for non-numeric ("-"/"*"/null). Matches the
// scorecard/distribution tables so Cp/Cpk/Pp/Ppk read consistently.
const STAT_MAX_NC = 0.9949;
const statMetricColor = (v) =>
  (v == null || v === '' || Number.isNaN(parseFloat(v))) ? undefined : (parseFloat(v) <= STAT_MAX_NC ? '#F54D41' : 'success.main');
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

const SubsampleScatterDistribution = () => {
  const location = useLocation();
  const drill = useDrilldownNavigate();
  const theme = useTheme();
  const axisTextColor = theme.palette.text.primary;
  const gridColor = theme.palette.divider;
  // Shared page: Historical Dimension origin keeps the legacy row-style General
  // Information; Dimension CPK origin uses the stat-tile grid. The first path
  // segment encodes the origin (URLs are hierarchical).
  const originModule = '/' + ((location?.pathname || '').split('/').filter(Boolean)[0] || '');
  const legacyGeneralInfo = originModule === '/lots-historical-summary' || originModule === '/nc-lot-bar';
  const { state } = location || {};
  const { selectedData } = state || {};
  const { isTimeSeries } = useContext(TimeSeriesContext); // 从context读取时间序列标志
  const requestedStartMonth = normalizeMonthValue(selectedData?.dateRange?.[0] ?? state?.filters?.StartMonth);
  const requestedEndMonth = normalizeMonthValue(selectedData?.dateRange?.[1] ?? state?.filters?.EndMonth);
  // console.log('Selected Data:', selectedData);
  const [allData, setAllData] = useState([]);
  const [statisticsValue, setStatisticsValue] = useState({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState(() => [
    monthToBoundaryDateString(requestedStartMonth, 'start'),
    monthToBoundaryDateString(requestedEndMonth, 'end'),
  ]);
  const [hoveredX, setHoveredX] = useState(null);
  // 新增：hover到点时高亮同LotNo
  const [hoveredLotNo, setHoveredLotNo] = useState(null);
  const [furnacePieData, setFurnacePieData] = useState([]);
  const [temperingPieData, setTemperingPieData] = useState([]);
  const [clickedFurnace, setClickedFurnace] = useState(null);
  const [selectedLotNo, setSelectedLotNo] = useState(null);

  // 新增：保存后端 summary 数据
  const [furnaceSummaryMC2, setFurnaceSummaryMC2] = useState([]);
  const [furnaceSummaryMC4, setFurnaceSummaryMC4] = useState([]);
  
  // 新增：当选择pie或日期range时的过滤数据和计算出的statistics
  const [filteredStatistics, setFilteredStatistics] = useState(null);
  const [filteredHistogramData, setFilteredHistogramData] = useState([]);

  useEffect(() => {
    setDateRange([
      monthToBoundaryDateString(requestedStartMonth, 'start'),
      monthToBoundaryDateString(requestedEndMonth, 'end'),
    ]);
  }, [requestedStartMonth, requestedEndMonth]);

  const availableDatesRaw = Array.from(new Set(
    allData.map(item => dayjs(item.MeasDate).format('MM/DD/YYYY'))
  )).sort((a, b) => dayjs(a, 'MM/DD/YYYY').valueOf() - dayjs(b, 'MM/DD/YYYY').valueOf());

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
  }, [availableDatesRaw, isTimeSeries, requestedEndMonth, requestedStartMonth]);

  const sliderDatesDisplay = sliderDatesRaw.map(d => dayjs(d, 'MM/DD/YYYY').format('MMM DD, YYYY'));
  const sliderDatesIso = sliderDatesRaw.map(d => dayjs(d, 'MM/DD/YYYY').format('YYYY-MM-DD'));

  const isDateAvailable = (date) => {
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
    if (selectedData) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const response = await axios.get(`${window.baseURL}/subsamples/all`, {
            params: {
              Dept: selectedData.Dept,
              MachineId: selectedData.MachineId,
              MaterialDesc: selectedData.MaterialDesc,
              DimensionDesc: selectedData.DimensionDesc,
              CAT: selectedData.CAT,
              DateFrom: selectedData.dateRange[0],
              DateTo: selectedData.dateRange[1],
            },
          });
          // 支持后端返回 { data, StatisticsValue }
          const dataArr = response.data?.data ? response.data.data : response.data;
          const statisticsValue = response.data?.statisticsValue ?? response.data?.StatisticsValue ?? {};
          setAllData(dataArr);
          setStatisticsValue(statisticsValue);
          console.log('Fetched all data:', response.data.data);
          console.log('Fetched Statistics Value:', response.data?.statisticsValue);
          // const filteredData = response.data.filter(item => {
          //   const date = new Date(item.MeasDate);
          //   return !isNaN(date) && date.toISOString().slice(0, 10) === '2025-10-13';
          // });
          // console.log('Filtered data:', filteredData);
        } catch (error) {
          console.error('Error fetching data:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();

      const fetchFurnaceSummary = async () => {
        try {
          const resp = await axios.get(`${window.baseURL}/subsamples/furnace-summary`, {
            params: {
              Dept: selectedData.Dept,
              MachineId: selectedData.MachineId,
              MaterialDesc: selectedData.MaterialDesc,
              DimensionDesc: selectedData.DimensionDesc,
              CAT: selectedData.CAT,
            },
          });
          // 兼容后端返回字段名（小写/大写/驼峰）
          const mc2 = resp.data?.CarbonizingFurnaceSummary || resp.data?.carbonizingFurnaceSummary || [];
          const mc4 = resp.data?.TemperingFurnaceSummary || resp.data?.temperingFurnaceSummary || [];
          setFurnacePieData(
            mc2.map(item => ({
              label: item.Furnace ?? item.furnace ?? 'Unknown',
              value: item.Count ?? item.count ?? 0,
              summary: item.Summary ?? item.summary ?? null,
            }))
          );
          setTemperingPieData(
            mc4.map(item => ({
              label: item.Furnace ?? item.furnace ?? 'Unknown',
              value: item.Count ?? item.count ?? 0,
              summary: item.Summary ?? item.summary ?? null,
            }))
          );
          setFurnaceSummaryMC2(mc2);
          setFurnaceSummaryMC4(mc4);
        } catch (e) {
          setFurnacePieData([]);
          setTemperingPieData([]);
          setFurnaceSummaryMC2([]);
          setFurnaceSummaryMC4([]);
        }
      };
      fetchFurnaceSummary();
    }
  }, [selectedData]);

  // 先按日期range过滤数据
  const filteredData = allData.filter(item => {
    if (!dateRange[0] && !dateRange[1]) return true;
    const itemDateStr = dayjs(item.MeasDate).format('MM/DD/YYYY');
    if (dateRange[0] && dayjs(itemDateStr, 'MM/DD/YYYY').isBefore(dayjs(dateRange[0], 'MM/DD/YYYY'))) return false;
    if (dateRange[1] && dayjs(itemDateStr, 'MM/DD/YYYY').isAfter(dayjs(dateRange[1], 'MM/DD/YYYY'))) return false;
    return true;
  });

  // 新增：当选择pie或日期range时，调用后端计算新的statistics
  useEffect(() => {
    const calculateFilteredMetrics = async () => {
      // 根据是否选择furnace来决定用哪个数据集
      let dataToAnalyze = filteredData;

      if (clickedFurnace) {
        // 如果选了furnace，在filteredData基础上再按furnace过滤
        dataToAnalyze = filteredData.filter(item => {
          if (clickedFurnace.type === 'MC2') {
            return item.CarbonizingFurnace === clickedFurnace.label;
          } else if (clickedFurnace.type === 'MC4') {
            return item.TemperingFurnace === clickedFurnace.label;
          }
          return true;
        });
      }

      // 提取MeasValue并调用后端endpoint（过滤掉无效MeasValue行）
      const validDataToAnalyze = dataToAnalyze.filter(item => {
        const v = parseFloat(item.MeasValue);
        return item.MeasValue !== null && item.MeasValue !== undefined && !isNaN(v);
      });
      const subsampleData = validDataToAnalyze.map(item => 
        ({ LotNo: item.LotNo, Value: parseFloat(item.MeasValue)}));
      const lsl = validDataToAnalyze.length > 0 ? validDataToAnalyze[0].LSL : null;
      const usl = validDataToAnalyze.length > 0 ? validDataToAnalyze[0].USL : null;

      if (subsampleData.length === 0 || lsl === null || usl === null) {
        setFilteredStatistics(null);
        setFilteredHistogramData([]);
        return;
      }

      try {
        const response = await axios.post(`${window.baseURL}/subsamples/calculate-subsample-metrics`, {
          SubsampleData: JSON.stringify(subsampleData),
          LSL: lsl,
          USL: usl,
        });
        const calculatedStats = response.data?.statisticsValue ?? response.data?.StatisticsValue ?? null;
        setFilteredStatistics(calculatedStats);
        console.log('Filtered Statistics:', response.data?.StatisticsValue);
        
        // 只有选了furnace时才设置filteredHistogramData
        if (clickedFurnace) {
          setFilteredHistogramData(subsampleData.map(item => item.Value));
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
  }, [clickedFurnace, dateRange, allData]);

  // 统计过滤后数据中 CarbonizingFurnace 和 TemperingFurnace 的出现次数，并按名字排序
  // 只统计 MeasValue 有效的行，与 statistics No of Data 基准一致
  const validFilteredData = React.useMemo(() => {
    return filteredData.filter(item => {
      const v = parseFloat(item.MeasValue);
      return item.MeasValue !== null && item.MeasValue !== undefined && !isNaN(v);
    });
  }, [filteredData]);

  const carbonizingStats = React.useMemo(() => {
    const map = {};
    validFilteredData.forEach(item => {
      const key = item.CarbonizingFurnace || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [validFilteredData]);

  const temperingStats = React.useMemo(() => {
    const map = {};
    validFilteredData.forEach(item => {
      const key = item.TemperingFurnace || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [validFilteredData]);

  // 饼图数据也用名字排序后的统计数据，并且label后加数量
  const furnacePieDataSorted = carbonizingStats.map((item, idx) => ({
    ...item,
    label: `${item.label} - ${item.value}`,
    color: PIE_COLORS[idx % PIE_COLORS.length],
    rawLabel: item.label,
    colorIdx: idx,
  }));
  const temperingPieDataSorted = temperingStats.map((item, idx) => ({
    ...item,
    label: `${item.label} - ${item.value}`,
    color: PIE_COLORS_MC4[idx % PIE_COLORS_MC4.length],
    rawLabel: item.label,
    colorIdx: idx,
  }));

  // x轴显示日期（MMM DD, YYYY），hover显示完整时间
  const scatterData = React.useMemo(() => {
    const arr = filteredData.map((item, idx) => ({
      x: dayjs(item.MeasDate).format('YYYY-MM-DD'),
      xLabel: dayjs(item.MeasDate).format('MMM DD, YYYY'),
      y: item.MeasValue,
      fullDate: dayjs(item.MeasDate).format('YYYY-MM-DD'),
      rawDate: item.MeasDate,
      idx,
      LotNo: item.LotNo,
      SubSampleNo: item.SubSampleNo,
      CarbonizingFurnace: item.CarbonizingFurnace || 'Unknown',
      TemperingFurnace: item.TemperingFurnace || 'Unknown'
    }));
    return arr.sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate));
  }, [filteredData]);

  // 当isTimeSeries为true时，填充缺失的日期 - 基于月份范围
  const displayData = React.useMemo(() => {
    if (!isTimeSeries || !scatterData || scatterData.length === 0) {
      return scatterData;
    }
    
    try {
      const sorted = [...scatterData].sort((a, b) => 
        new Date(a.fullDate) - new Date(b.fullDate)
      );
      
      // 优先使用当前 dateRange，其次使用上一页传来的月份范围，否则使用数据范围
      let minDate, maxDate;

      if (dateRange[0] && dateRange[1]) {
        minDate = dayjs(dateRange[0], 'MM/DD/YYYY');
        const rawMax = dayjs(dateRange[1], 'MM/DD/YYYY');
        const today = dayjs();
        maxDate = rawMax.isAfter(today) ? today : rawMax;
        console.log('Gap Filling Scatter: Using current dateRange (clipped to today)', {
          start: minDate.format('YYYY-MM-DD'),
          end: maxDate.format('YYYY-MM-DD'),
          dataPoints: sorted.length
        });
      } else if (requestedStartMonth && requestedEndMonth) {
        minDate = dayjs(monthToBoundaryDateString(requestedStartMonth, 'start'), 'MM/DD/YYYY');
        maxDate = dayjs(monthToBoundaryDateString(requestedEndMonth, 'end'), 'MM/DD/YYYY');
        console.log('Gap Filling Scatter: Using filter month range', { 
          start: minDate.format('YYYY-MM-DD'),
          end: maxDate.format('YYYY-MM-DD'),
          dataPoints: sorted.length
        });
      } else {
        // Fallback: 使用数据的 min/max
        minDate = dayjs(sorted[0].fullDate);
        maxDate = dayjs(sorted[sorted.length - 1].fullDate);
        console.log('Gap Filling Scatter: Using data range (no filter provided)', { 
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
      
      console.log('After Scatter Gap Filling:', {
        totalPoints: result.length,
        filledDays: filledCount,
        originalPoints: sorted.length
      });
      
      
      return result;
    } catch (error) {
      console.error('Error in displayData:', error);
      return scatterData;
    }
  }, [scatterData, isTimeSeries, requestedStartMonth, requestedEndMonth, dateRange]);

  // 计算 Y 值（用于直方图和钟形曲线）
  const yValues = React.useMemo(() => {
    // 如果选了furnace，只用对应furnace的数据；否则用所有filteredData
    let dataToUse = filteredData;
    if (clickedFurnace) {
      dataToUse = filteredData.filter(item => {
        if (clickedFurnace.type === 'MC2') {
          return item.CarbonizingFurnace === clickedFurnace.label;
        } else if (clickedFurnace.type === 'MC4') {
          return item.TemperingFurnace === clickedFurnace.label;
        }
        return true;
      });
    }
    return dataToUse.map(item => Number(item.MeasValue)).filter(v => !isNaN(v));
  }, [filteredData, clickedFurnace]);

  // 计算 skewness
  const skewness = React.useMemo(() => {
    if (!yValues || yValues.length < 3) return null;
    const n = yValues.length;
    const mean = d3.mean(yValues);
    const std = d3.deviation(yValues);
    if (!std || std === 0) return null;
    const m3 = d3.mean(yValues.map(v => Math.pow(v - mean, 3)));
    return ((n / ((n - 1) * (n - 2))) * (m3 / Math.pow(std, 3))).toFixed(3);
  }, [yValues]);

  const { bellCurve, binWidth, xMin, xMax } = React.useMemo(() => {
    if (!yValues || yValues.length < 3) return { bellCurve: [], binWidth: 1, xMin: 0, xMax: 1 };
    
    const mean = d3.mean(yValues);
    const std = d3.deviation(yValues);
    const min = Math.min(...yValues);
    const max = Math.max(...yValues);
    
    // 1. 扩展 X 轴范围 (仿 Minitab 效果)
    // 通常取均值左右 3.5 到 4 个标准差，或者根据数据极值向外扩充
    const displayMin = Math.min(min, mean - 4 * std);
    const displayMax = Math.max(max, mean + 4 * std);
    
    const binCount = Math.ceil((Math.log2(yValues.length) + 1) * 2);
    const width = (max - min) / binCount;
    
    const pdf = x => (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
    
    const steps = 200;
    // 使用扩展后的范围生成 X 轴坐标
    const xs = Array.from({ length: steps }, (_, i) => displayMin + (displayMax - displayMin) * i / (steps - 1));
    
    const curve = xs.map(x => ({
      x,
      // 这里的缩放系数：yValues.length * width 是为了对齐直方图的 Count 坐标系
      y: pdf(x) * yValues.length * width
    }));
    
    return { bellCurve: curve, binWidth: width, xMin: displayMin, xMax: displayMax };
  }, [yValues]);

  // 统计每个x（日期）有多少个点
  const scatterCountByX = React.useMemo(() => {
    const map = {};
    scatterData.forEach(item => {
      map[item.x] = (map[item.x] || 0) + 1;
    });
    return map;
  }, [scatterData]);

  // 只修改scatter点样式，不改变颜色，hover时同LotNo点发光
  const scatterColors = React.useMemo(() => {
    // 颜色逻辑和furnace数据相关
    return scatterData.map((item) => {
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
  }, [scatterData, clickedFurnace]);

  // hover时同LotNo点发光，利用marker.line和size变化
  const scatterMarker = React.useMemo(() => {
    const colors = scatterColors;
    if (hoveredLotNo) {
      return {
        color: colors,
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
      color: colors,
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

  // Scatter-specific Y-range (actual data min/max)
  const scatterYValues = React.useMemo(() => {
    return filteredData.map(item => Number(item.MeasValue)).filter(v => !isNaN(v));
  }, [filteredData]);
  const scatterYMin = scatterYValues.length > 0 ? Math.min(...scatterYValues) : 0;
  const scatterYMax = scatterYValues.length > 0 ? Math.max(...scatterYValues) : 1;
  const scatterPadding = (scatterYMax - scatterYMin) * 0.1 || 0.5;
  const scatterYMinPad = scatterYMin - scatterPadding;
  const scatterYMaxPad = scatterYMax + scatterPadding;

  // Histogram数据 - 用于计算Y轴范围
  const histogramData = React.useMemo(() => {
    // 如果选了furnace且有过滤的histogram数据，返回合并数据用于y轴计算
    if (clickedFurnace && filteredHistogramData.length > 0) {
      return [...filteredData.map((item) => parseFloat(item.MeasValue)), ...filteredHistogramData];
    }
    // 否则用按日期range过滤后的数据
    return filteredData.map((item) => parseFloat(item.MeasValue));
  }, [filteredData, clickedFurnace, filteredHistogramData]);
  const yMin = histogramData.length > 0 ? Math.min(...histogramData) : 0;
  const yMax = histogramData.length > 0 ? Math.max(...histogramData) : 1;
  const padding = (yMax - yMin) * 0.1;
  const yMinPad = yMin - padding;
  const yMaxPad = yMax + padding;

  // 先定义 LSL/USL
  const LSL = allData.length > 0 
    ? (allData[0].LSL < -999 ? null : allData[0].LSL)
    : null;
  const USL = allData.length > 0 
    ? (allData[0].USL > 999 ? null : allData[0].USL)
    : null;

  // 固定Y轴范围逻辑
  let fixedYMin = 0, fixedYMax = 1;
  const allHistogramData = allData.map(item => parseFloat(item.MeasValue));
  if (allHistogramData.length > 0) {
    const minDataset = Math.min(...allHistogramData);
    const maxDataset = Math.max(...allHistogramData);
    const lslNum = (typeof LSL === 'string' && !isNaN(Number(LSL))) ? Number(LSL) : LSL;
    const uslNum = (typeof USL === 'string' && !isNaN(Number(USL))) ? Number(USL) : USL;
    if (typeof lslNum === 'number' && !isNaN(lslNum)) {
      fixedYMin = minDataset < lslNum ? minDataset : lslNum;
    } else {
      fixedYMin = minDataset;
    }
    if (typeof uslNum === 'number' && !isNaN(uslNum)) {
      fixedYMax = maxDataset > uslNum ? maxDataset : uslNum;
    } else {
      fixedYMax = maxDataset;
    }
  }
  const fixedPadding = (fixedYMax - fixedYMin) * 0.01;
  const fixedYMinPad = fixedYMin - fixedPadding;
  const fixedYMaxPad = fixedYMax + fixedPadding;

  function getSparseTicks(dates, maxLabels = 13) {
    if (dates.length <= maxLabels) return dates;
    const step = Math.ceil(dates.length / (maxLabels - 1));
    const ticks = [];
    for (let i = 0; i < dates.length; i += step) {
      ticks.push(dates[i]);
    }
    if (ticks[ticks.length - 1] !== dates[dates.length - 1]) {
      ticks.push(dates[dates.length - 1]);
    }
    return ticks;
  }

  const monthFirstTickPairs = React.useMemo(() => {
    if (!isTimeSeries || sliderDatesIso.length === 0) {
      return null;
    }

    const monthFirstDateSet = new Set();
    sliderDatesIso.forEach((isoDate) => {
      const parsed = dayjs(isoDate, 'YYYY-MM-DD', true);
      if (parsed.isValid() && parsed.date() === 1) {
        monthFirstDateSet.add(isoDate);
      }
    });

    if (monthFirstDateSet.size > 0) {
      return {
        tickvals: sliderDatesIso,
        ticktext: sliderDatesIso.map((isoDate, idx) => (
          monthFirstDateSet.has(isoDate) ? sliderDatesDisplay[idx] : ''
        )),
      };
    }

    return {
      tickvals: getSparseTicks(sliderDatesIso),
      ticktext: getSparseTicks(sliderDatesDisplay),
    };
  }, [isTimeSeries, sliderDatesDisplay, sliderDatesIso]);

  const hoveredXIndex = hoveredX
    ? scatterData.findIndex(item => item.x === hoveredX)
    : -1;

  const verticalLineShape = (hoveredXIndex >= 0
    ? [{
        type: 'line',
        xref: 'x1',
        x0: scatterData[hoveredXIndex].x,
        x1: scatterData[hoveredXIndex].x,
        yref: 'paper',
        y0: 0,
        y1: 1,
        line: { color: '#1976d2', width: 2, dash: 'dot' },
      }]
    : []
  );

  // annotation for count above vertical line
  const verticalLineAnnotation = (hoveredXIndex >= 0
    ? [{
        x: scatterData[hoveredXIndex].x,
        y: scatterYMaxPad,
        xref: 'x1',
        yref: 'y1',
        text: `Count: ${scatterCountByX[scatterData[hoveredXIndex].x] ?? 0}`,
        showarrow: false,
        font: { color: '#1976d2', size: 18, weight: 'bold' },
        align: 'center',
        yanchor: 'bottom',
        bgcolor: 'white',
        bordercolor: '#1976d2',
        borderpad: 4,
        borderwidth: 2,
        opacity: 0.95,
      }]
    : []);

  const availableYears = Array.from(new Set(
    availableDatesRaw.map(d => dayjs(d, 'MM/DD/YYYY').year())
  ));
  const availableYearMonths = new Set(
    availableDatesRaw.map(d => dayjs(d, 'MM/DD/YYYY').format('YYYY-MM'))
  );

  const getSelectedDay = (value) => {
    if (!value) return null;
    const parsed = dayjs(value, 'MM/DD/YYYY');
    return parsed.isValid() ? parsed : null;
  };

  const shouldDisableDateKeepSelected = (date, selectedValue) => {
    const selectedDay = getSelectedDay(selectedValue);
    if (selectedDay && date && dayjs(date).isSame(selectedDay, 'day')) return false;
    return !isDateAvailable(date);
  };

  const shouldDisableYearKeepSelected = (year, selectedValue) => {
    const selectedDay = getSelectedDay(selectedValue);
    if (selectedDay && year?.year() === selectedDay.year()) return false;
    return !availableYears.includes(year.year());
  };

  const shouldDisableMonthKeepSelected = (month, selectedValue) => {
    const selectedDay = getSelectedDay(selectedValue);
    const monthKey = month.format('YYYY-MM');
    if (selectedDay && monthKey === selectedDay.format('YYYY-MM')) return false;
    return !availableYearMonths.has(monthKey);
  };

  // 弹窗相关状态
  const [openRawData, setOpenRawData] = useState(false);


  // 弹窗表格列定义（与示例一致）
  const rawDataColumns = [
    { key: 'LotNo', label: 'LotNo' },
    { key: 'CarbonizingFurnace', label: 'Carburizing Furnace' },
    { key: 'TemperingFurnace', label: 'Tempering Furnace' },
    { key: 'SubSampleNo', label: 'SubSampleNo' }, // after Tempering Furnace, before MeasValue
    { key: 'MeasValue', label: 'MeasValue' },
    { key: 'MeasDate', label: 'MeasDate' },
  ];

  // 弹窗数据，取filteredData，按MeasDate排序，MeasDate格式化显示
  const rawDataRows = React.useMemo(() => {
    return filteredData
      .filter(item => {
        const v = parseFloat(item.MeasValue);
        return item.MeasValue !== null && item.MeasValue !== undefined && !isNaN(v);
      })
      .sort((a, b) => new Date(a.MeasDate) - new Date(b.MeasDate))
      .map(item => ({
        ...item,
        MeasDate: dayjs(item.MeasDate).isValid() ? dayjs(item.MeasDate).format('MMM DD, YYYY') : item.MeasDate,
      }));
  }, [filteredData]);

  // Download用数据，在rawDataRows基础上加上5个General Info列
  const downloadDataRows = React.useMemo(() => {
    return rawDataRows.map(item => ({
      Dept: selectedData?.Dept ?? '',
      MachineId: selectedData?.MachineId ?? '',
      MaterialDesc: selectedData?.MaterialDesc ?? '',
      DimensionDesc: selectedData?.DimensionDesc ?? '',
      CAT: selectedData?.CAT ?? '',
      ...item,
    }));
  }, [rawDataRows, selectedData]);

  const downloadColumns = [
    'Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT',
    ...rawDataColumns.map(col => col.key),
  ];

  // 弹窗标题
  const rawDataTitle = 'Retrieve raw data';

  // 统计区展示内容
  const statisticsToShow = React.useMemo(() => {
    // filteredStatistics 可能是空对象，不能覆盖原始 statisticsValue
    if (filteredStatistics && Object.keys(filteredStatistics).length > 0) {
      return filteredStatistics;
    }
    // 否则用原始的statistics
    return statisticsValue;
  }, [filteredStatistics, statisticsValue]);

  // BRD (Historical Dimension drill-in): General Information shows the Period as a
  // range (e.g. "Jun 2025 – Jul 2026"); Statistics shows Target = (LSL+USL)/2.
  const fmtMonthLabel = (m) => {
    const s = String(m || '');
    if (!/^\d{6}$/.test(s)) return s || '-';
    const d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-01`);
    return `${d.toLocaleString('en-US', { month: 'short' })} ${s.slice(0, 4)}`;
  };
  const periodRangeLabel = (requestedStartMonth && requestedEndMonth)
    ? `${fmtMonthLabel(requestedStartMonth)} – ${fmtMonthLabel(requestedEndMonth)}`
    : (requestedStartMonth ? fmtMonthLabel(requestedStartMonth) : '-');
  // Month-level range that follows the live date slider (the download data is filtered
  // by dateRange). Drives the exported filename, the exported "Period" field, and the
  // on-screen General Information Period so all three match the actually-shown data.
  const fmtMonthFromMDY = (d) => (d ? dayjs(d, 'MM/DD/YYYY').format('MMM YYYY') : '');
  const periodRangeDisplay = (() => {
    const s = fmtMonthFromMDY(dateRange[0]);
    const e = fmtMonthFromMDY(dateRange[1]);
    if (s && e) return `${s} – ${e}`;
    if (s) return s;
    if (e) return e;
    return periodRangeLabel;
  })();
  const _lslNum = Number(allData[0]?.LSL);
  const _uslNum = Number(allData[0]?.USL);
  const targetValue = (Number.isFinite(_lslNum) && Number.isFinite(_uslNum) && _lslNum > -999 && _uslNum < 999)
    ? ((_lslNum + _uslNum) / 2)
    : '-';

  // Combined date-range field (Key Focus pattern): a single field that opens a
  // popover holding the two calendars, with an inline clear (X).
  const [dateAnchorEl, setDateAnchorEl] = useState(null);
  const dateRangeDisplay = (() => {
    const fmt = (d) => (d ? dayjs(d, 'MM/DD/YYYY').format('MMM DD, YYYY') : '');
    const s = fmt(dateRange[0]);
    const e = fmt(dateRange[1]);
    if (s && e) return `${s} – ${e}`;
    if (s) return `${s} – …`;
    if (e) return `… – ${e}`;
    return '';
  })();

  const hasNoFilteredData = !loading && filteredData.length === 0;

  return (
    <Box sx={{ padding: 4, mb: 4, width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
  <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 1, p: 1.5, mb: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', width: '100%', boxSizing: 'border-box' }}>
    {/* Header row: title + date-range field + download (Key Focus card pattern) */}
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
        Subsample Scatter Distribution
      </Typography>
      {/* Combined date-range field (Key Focus pattern) opens a popover with two calendars. */}
      <TextField
        size="small"
        value={dateRangeDisplay}
        placeholder="All dates"
        onClick={e => setDateAnchorEl(e.currentTarget)}
        InputProps={{
          readOnly: true,
          startAdornment: (
            <InputAdornment position="start">
              <CalendarMonthIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
          endAdornment: (dateRange[0] || dateRange[1]) ? (
            <InputAdornment position="end">
              <Tooltip title="Clear date range">
                <IconButton size="small" onClick={e => { e.stopPropagation(); setDateRange([null, null]); }} sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </InputAdornment>
          ) : null,
        }}
        sx={{ flex: '0 0 auto', width: 320, ml: 'auto', '& .MuiInputBase-root': { height: 40, cursor: 'pointer' }, '& input': { cursor: 'pointer' } }}
      />
      <Popover
        open={Boolean(dateAnchorEl)}
        anchorEl={dateAnchorEl}
        onClose={() => setDateAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ p: 1.5 }}>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textAlign: 'center' }}>Start Date</Typography>
            <DateCalendar
              views={['year', 'month', 'day']}
              value={dateRange[0] ? dayjs(dateRange[0], 'MM/DD/YYYY') : null}
              onChange={val => setDateRange([val ? val.format('MM/DD/YYYY') : null, dateRange[1]])}
              shouldDisableDate={date => shouldDisableDateKeepSelected(date, dateRange[0])}
              shouldDisableYear={year => shouldDisableYearKeepSelected(year, dateRange[0])}
              shouldDisableMonth={month => shouldDisableMonthKeepSelected(month, dateRange[0])}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textAlign: 'center' }}>End Date</Typography>
            <DateCalendar
              views={['year', 'month', 'day']}
              value={dateRange[1] ? dayjs(dateRange[1], 'MM/DD/YYYY') : null}
              onChange={val => setDateRange([dateRange[0], val ? val.format('MM/DD/YYYY') : null])}
              shouldDisableDate={date => shouldDisableDateKeepSelected(date, dateRange[1])}
              shouldDisableYear={year => shouldDisableYearKeepSelected(year, dateRange[1])}
              shouldDisableMonth={month => shouldDisableMonthKeepSelected(month, dateRange[1])}
            />
          </Box>
        </Stack>
      </Popover>
      {/* BRD (Historical Dimension): Download Subsample Data sits beside the date-range filter. */}
      <CsvExportButton
        data={downloadDataRows}
        headers={downloadColumns}
        filename={`Historical Dimension Subsample Data${periodRangeDisplay && periodRangeDisplay !== '-' ? '_' + periodRangeDisplay : ''}.csv`}
        generalInfo={[
          { label: 'Report', value: 'Subsample Distribution — Raw Data' },
          { label: 'Period', value: periodRangeDisplay },
          { label: 'Dept', value: selectedData?.Dept || '' },
          { label: 'MachineId', value: selectedData?.MachineId || '' },
          { label: 'MaterialDesc', value: selectedData?.MaterialDesc || '' },
          { label: 'DimensionDesc', value: selectedData?.DimensionDesc || '' },
          { label: 'CAT', value: selectedData?.CAT || '' },
        ]}
        statistics={[
          { label: 'No of Data', value: statisticsToShow?.Count ?? allData.length ?? '' },
          { label: 'Mean', value: statisticsToShow?.MeanValue ?? allData[0]?.MeanValue ?? '' },
          { label: 'Std Dev', value: statisticsToShow?.StdValue != null ? Number(statisticsToShow.StdValue).toFixed(3) : '' },
          { label: 'LSL', value: allData[0]?.LSL ?? '' },
          { label: 'USL', value: allData[0]?.USL ?? '' },
          { label: 'Target', value: targetValue },
          { label: 'CP', value: statisticsToShow?.CPValue ?? '' },
          { label: 'CPK', value: statisticsToShow?.CPKValue ?? '' },
          { label: 'PP', value: statisticsToShow?.PPValue ?? '' },
          { label: 'PPK', value: statisticsToShow?.PPKValue ?? '' },
        ]}
        sx={{ height: 40, px: 2.5, fontSize: 14, textTransform: 'none', whiteSpace: 'nowrap', borderRadius: 2 }}
        variant="outlined"
      >
        Download Subsample Data
      </CsvExportButton>
      </Box>
      {/* Quick date-range slider — same card as the header, matching the Key Focus reference. */}
      {availableDatesRaw.length > 1 && (
        <Box sx={{ width: '100%', px: 2, pt: 0.5, pb: 0.5 }}>
          <Slider
            value={safeSliderValue}
            min={minSlider}
            max={maxSlider}
            step={1}
            onChange={(_, newValue) => { if (Array.isArray(newValue)) { setDateRange([sliderDatesRaw[newValue[0]], sliderDatesRaw[newValue[1]]]); } }}
            valueLabelDisplay="auto"
            valueLabelFormat={idx => sliderDatesDisplay[idx] ?? ''}
            sx={{ width: '100%', height: 6, '& .MuiSlider-rail': { height: 6 }, '& .MuiSlider-track': { height: 6 }, '& .MuiSlider-thumb': { width: 20, height: 20 }, '& .MuiSlider-valueLabel': { fontSize: 13, background: '#13133F', color: 'white', borderRadius: 2, px: 2, py: 1 } }}
            disabled={sliderDatesRaw.length < 2}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography sx={{ fontSize: 13, color: 'text.primary', fontWeight: 600 }}>{sliderDatesDisplay[minSlider]}</Typography>
            <Typography sx={{ fontSize: 13, color: 'text.primary', fontWeight: 600 }}>{sliderDatesDisplay[maxSlider]}</Typography>
          </Box>
        </Box>
      )}
    </Box>
  </LocalizationProvider>
  {loading ? (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
      <CircularProgress />
    </Box>
  ) : hasNoFilteredData ? (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '320px',
        border: '1px dashed rgba(255,255,255,0.35)',
        borderRadius: 2,
      }}
    >
      <Typography variant="h5">
        No data found
      </Typography>
    </Box>
  ) : (
    <Grid container spacing={2} sx={{ minWidth: 0, width: '100%', maxWidth: '100vw', overflow: 'hidden' }}>
      {/* 左侧图表区 */}
      <Grid item xs={12} md={8.5} sx={{
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch'
      }}>
        <Box sx={{ width: '100%', flexGrow: 1, border: '1px solid', borderColor: 'divider', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', bgcolor: 'background.paper', p: { xs: 1.5, md: 2.5 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: 'stretch' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
          <PlotlyComponent
            data={[
              {
                x: displayData.map((item) => item.x),
                y: displayData.map((item) => item.y),
                mode: 'markers',
                type: 'scatter',
                name: 'Scatter',
                marker: displayMarker,
                xaxis: 'x1',
                yaxis: 'y1',
                text: displayData.map(item =>
                  item.idx === -1 
                    ? `<b>No Data</b><br>Date: ${item.xLabel ?? item.x}`
                    : `<b>LotNo: ${item.LotNo ?? '-'}</b><br>` +
                      `SubSampleNo: ${item.SubSampleNo ?? '-'}<br>` +
                      `CarbonizingFurnace: ${item.CarbonizingFurnace ?? '-'}<br>` +
                      `TemperingFurnace: ${item.TemperingFurnace ?? '-'}<br>` +
                      `MeasValue: ${item.y ?? '-'}<br>` +
                      `Date: ${item.xLabel ?? '-'}<br>` +
                      `<i style="font-weight: bold;margin-top: 10px"><b>Click to view Individual Lot Distribution</b></i>`
                ),
                hovertemplate: '%{text}<extra></extra>',
                hoverinfo: 'text',
                customdata: displayData.map(item => item.LotNo),
              },
              {
                y: yValues,
                type: 'histogram',
                orientation: 'h',
                name: 'Histogram',
                // Keep the default "(count, bin range)" hover but drop the "Histogram"
                // trace-name box by excluding the 'name' flag from hoverinfo.
                hoverinfo: 'x+y',
                marker: {
                  color: clickedFurnace ? clickedFurnace.color : 'rgba(79,158,248,0.6)',
                  line: { color: 'white', width: 2 },
                },
                opacity: 0.7,
                xaxis: 'x2',
                yaxis: 'y1',
                ybins: {
                  start: xMin,
                  end: xMax,
                  size: binWidth,
                },
              },
              // {
              //   x: bellCurve.map(d => d.y),
              //   y: bellCurve.map(d => d.x),
              //   type: 'scatter',
              //   mode: 'lines+markers',
              //   name: 'Bell Curve',
              //   xaxis: 'x2',
              //   yaxis: 'y1',
              //   line: { color: '#FF5733', width: 2.5, dash: 'solid' },
              //   marker: { size: 1, color: '#FF5733' },
              //   hoverinfo: 'skip',
              // },
              // {
              //   x: bellCurve.map(d => d.y),
              //   y: bellCurve.map(d => d.x),
              //   type: 'scatter',
              //   mode: 'none',
              //   name: 'Bell Curve Fill',
              //   xaxis: 'x2',
              //   yaxis: 'y1',
              //   fill: 'tonextx',
              //   fillcolor: 'rgba(255, 87, 51, 0.25)',
              //   line: { color: 'rgba(255, 87, 51, 0)' },
              //   showlegend: false,
              //   hoverinfo: 'skip',
              // },
            ]}
            layout={{
              paper_bgcolor: 'transparent',
              plot_bgcolor: 'transparent',
              grid: { rows: 1, columns: 2, pattern: 'independent' },
              font: { size: 15, color: axisTextColor },
              xaxis: { 
                type: isTimeSeries ? 'date' : 'category',
                domain: [0, 0.72],
                ...(isTimeSeries ? {
                  tickmode: 'array',
                  tickvals: monthFirstTickPairs?.tickvals ?? [],
                  ticktext: monthFirstTickPairs?.ticktext ?? [],
                } : {
                  tickvals: getSparseTicks(displayData.map(item => item.x)),
                  ticktext: getSparseTicks(displayData.map(item => item.xLabel ?? item.x)),
                }),
                ...(isTimeSeries ? { tickformat: '%b %d, %Y' } : {}),
                tickangle: -45,
                ticklabelposition: 'bottom',
                showticklabels: true,
                tickfont: { size: X_AXIS_TICK_LABEL_FONT_SIZE, color: axisTextColor },
                gridcolor: gridColor,
                zerolinecolor: gridColor,
              },
              yaxis: {
                title: { text: 'MeasValue', font: { size: AXIS_TITLE_FONT_SIZE, color: axisTextColor } },
                domain: [0, 1],
                range: [fixedYMinPad, fixedYMaxPad],
                showticklabels: true,
                fixedrange: true,
                tickfont: { size: AXIS_TICK_FONT_SIZE, color: axisTextColor },
                gridcolor: gridColor,
                zerolinecolor: gridColor,
              },
              xaxis2: {
                title: { text: 'Count', font: { size: 16, color: axisTextColor } },
                domain: [0.74, 1],
                tickfont: { size: 16, color: axisTextColor },
              },
              width: undefined,
              height: CHART_HEIGHT,
              autosize: true,
              margin: { t: 40, l: 80, r: 60, b: 120 },
              shapes: [
                ...(LSL !== null
                  ? [{
                      type: 'line',
                      xref: 'paper',
                      x0: 0,
                      x1: 1,
                      y0: LSL,
                      y1: LSL,
                      yref: 'y1',
                      line: { color: '#F54D41', width: 2, dash: 'dot' },
                    }]
                  : []),
                ...(USL !== null
                  ? [{
                      type: 'line',
                      xref: 'paper',
                      x0: 0,
                      x1: 1,
                      y0: USL,
                      y1: USL,
                      yref: 'y1',
                      line: { color: '#F54D41', width: 2, dash: 'dot' },
                    }]
                  : []),
                // Target line = (LSL + USL) / 2, drawn green (like the histogram's Target).
                ...(Number.isFinite(targetValue)
                  ? [{
                      type: 'line',
                      xref: 'paper',
                      x0: 0,
                      x1: 1,
                      y0: targetValue,
                      y1: targetValue,
                      yref: 'y1',
                      line: { color: 'green', width: 2, dash: 'dot' },
                    }]
                  : []),
                ...verticalLineShape,
              ],
              annotations: [
                // Spec labels anchored just past the plot's right edge, sitting on their
                // dashed lines — LSL/USL/Target all placed the same way on the right.
                ...(LSL !== null
                  ? [{
                      x: 1,
                      xanchor: 'left',
                      y: LSL,
                      xref: 'paper',
                      yref: 'y1',
                      text: 'LSL',
                      showarrow: false,
                      font: { color: '#F54D41', size: 14 },
                    }]
                  : []),
                ...(USL !== null
                  ? [{
                      x: 1,
                      xanchor: 'left',
                      y: USL,
                      xref: 'paper',
                      yref: 'y1',
                      text: 'USL',
                      showarrow: false,
                      font: { color: '#F54D41', size: 14 },
                    }]
                  : []),
                ...(Number.isFinite(targetValue)
                  ? [{
                      x: 1,
                      xanchor: 'left',
                      y: targetValue,
                      xref: 'paper',
                      yref: 'y1',
                      text: 'Target',
                      showarrow: false,
                      font: { color: 'green', size: 14 },
                    }]
                  : []),
                ...verticalLineAnnotation,
              ],
              showlegend: false,
            }}
            style={{
              width: '100%',
              height: CHART_HEIGHT,
              minWidth: 0,
              maxWidth: '100%',
              margin: '0 auto',
              display: 'block'
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
                if (pt.curveNumber === 0) {
                  const clickedPoint = displayData[pt.pointIndex];
                  const lotNo = clickedPoint?.LotNo || null;
                  const moreDataPoint = filteredData.find(item => (
                    item.LotNo === lotNo
                    && dayjs(item.MeasDate).format('YYYY-MM-DD') === clickedPoint?.fullDate
                  ));
                  if (lotNo && moreDataPoint) {
                    setSelectedLotNo(lotNo);
                    // 导航到 Individual Lot Distribution 页面
                    // TODO:Fix Period Parsing to avoid invalid date error
                    drill('lots-sample-distribution-table', {
                      state: {
                        // Dept: moreDataPoint.Dept,
                        // MachineId: moreDataPoint.MachineId,
                        // MaterialDesc: moreDataPoint.MaterialDesc,
                        // DimensionDesc: moreDataPoint.DimensionDesc, 
                        // CAT: moreDataPoint.CAT,
                        // Period: moreDataPoint.Period,
                        // LotNo: moreDataPoint.LotNo,
                      row: moreDataPoint,  // 注意这里要改成 row
                      Period: moreDataPoint?.Period ? moreDataPoint.Period : null,
                      displayPP: false,
                      }
                    });
                    console.log('Navigating to Individual Lot Distribution page with state:', {
                      row: moreDataPoint,  // 注意这里要改成 row
                      Period: moreDataPoint?.Period ? moreDataPoint.Period : null,
                      displayPP: false,
                  })
                }
              }
            }}
          }
          />
          </Box>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', md: 'block' } }} />
          <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 320 }, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mb: 2 }}>
            <LocalFireDepartmentIcon sx={{ color: 'warning.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Furnace Data (Summary)</Typography>
          </Stack>
          <Box sx={{ width: '100%', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }}>
            {/* MC2 Pie (Carburizing) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <Typography variant="subtitle1" textAlign="center" sx={{ mb: 1, fontWeight: 600 }}>Carburizing Furnace (TVC)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1.5, width: '100%' }}>
                <Box sx={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                  <PieChart
                    series={[
                      {
                        data: furnacePieDataSorted.length
                          ? furnacePieDataSorted
                          : [{ label: 'No Data', value: 1, color: 'rgba(148,163,184,0.18)', rawLabel: 'No Data' }],
                        highlightScope: { faded: 'global', highlighted: 'item' },
                        cornerRadius: 6,
                        paddingAngle: 2,
                        innerRadius: 44,
                        outerRadius: 72,
                        cx: 75,
                        cy: 75,
                        color: (item) => item.color,
                      },
                    ]}
                    slotProps={{ legend: { hidden: true } }}
                    width={150}
                    height={150}
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                    onItemClick={(event, d) => {
                      const pie = furnacePieDataSorted[d.dataIndex];
                      if (!pie) return;
                      if (clickedFurnace && clickedFurnace.type === 'MC2' && clickedFurnace.label === pie.rawLabel) setClickedFurnace(null);
                      else setClickedFurnace({ type: 'MC2', label: pie.rawLabel, color: pie.color });
                    }}
                  />
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{furnacePieDataSorted.reduce((s, d) => s + (Number(d.value) || 0), 0)}</Typography>
                  </Box>
                </Box>
                {/* TVC labelling beside the pie */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'flex-start', minWidth: 0 }}>
                  {(furnacePieDataSorted.length ? furnacePieDataSorted : []).map((item) => {
                    const lbl = item.rawLabel ?? item.label;
                    const active = clickedFurnace?.type === 'MC2' && clickedFurnace?.label === lbl;
                    return (
                    <Box
                      key={lbl}
                      onClick={() => { if (lbl !== 'No Data') setClickedFurnace(active ? null : { type: 'MC2', label: lbl, color: item.color }); }}
                      sx={{ px: 1, py: 0.5, borderRadius: 1, border: '1px solid', borderColor: item.color, color: active ? '#222' : item.color, bgcolor: active ? item.color : 'transparent', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', cursor: lbl === 'No Data' ? 'default' : 'pointer', '&:hover': lbl === 'No Data' ? {} : { bgcolor: item.color, color: '#222' } }}
                    >
                      {lbl} ({item.value})
                    </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
            {/* MC4 Pie (Tempering) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <Typography variant="subtitle1" textAlign="center" sx={{ mb: 1, fontWeight: 600 }}>Tempering Furnace (TAT)</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 1.5, width: '100%' }}>
                <Box sx={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
                  <PieChart
                    series={[
                      {
                        data: temperingPieDataSorted.length
                          ? temperingPieDataSorted
                          : [{ label: 'No Data', value: 1, color: 'rgba(148,163,184,0.18)', rawLabel: 'No Data' }],
                        highlightScope: { faded: 'global', highlighted: 'item' },
                        cornerRadius: 6,
                        paddingAngle: 2,
                        innerRadius: 44,
                        outerRadius: 72,
                        cx: 75,
                        cy: 75,
                        color: (item) => item.color,
                      },
                    ]}
                    onItemClick={(event, d) => {
                      const pie = temperingPieDataSorted[d.dataIndex];
                      if (!pie) return;
                      if (clickedFurnace && clickedFurnace.type === 'MC4' && clickedFurnace.label === pie.rawLabel) setClickedFurnace(null);
                      else setClickedFurnace({ type: 'MC4', label: pie.rawLabel, color: pie.color });
                    }}
                    slotProps={{ legend: { hidden: true } }}
                    width={150}
                    height={150}
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                  />
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>{temperingPieDataSorted.reduce((s, d) => s + (Number(d.value) || 0), 0)}</Typography>
                  </Box>
                </Box>
                {/* TAT labelling beside the pie */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: 'flex-start', minWidth: 0 }}>
                  {(temperingPieDataSorted.length ? temperingPieDataSorted : []).map((item) => {
                    const lbl = item.rawLabel ?? item.label;
                    const active = clickedFurnace?.type === 'MC4' && clickedFurnace?.label === lbl;
                    return (
                    <Box
                      key={lbl}
                      onClick={() => { if (lbl !== 'No Data') setClickedFurnace(active ? null : { type: 'MC4', label: lbl, color: item.color }); }}
                      sx={{ px: 1, py: 0.5, borderRadius: 1, border: '1px solid', borderColor: item.color, color: active ? '#222' : item.color, bgcolor: active ? item.color : 'transparent', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', cursor: lbl === 'No Data' ? 'default' : 'pointer', '&:hover': lbl === 'No Data' ? {} : { bgcolor: item.color, color: '#222' } }}
                    >
                      {lbl} ({item.value})
                    </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </Box>
          </Box>
        </Box>
        {/* Date-range slider moved to the top header card (Key Focus reference pattern). */}
      </Grid>
      {/* 右侧信息区 */}
      <Grid item xs={12} md={3.5} sx={{
        minWidth: 0,
        maxWidth: 500,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch'
      }}>
        {/* 导出按钮放在右侧表格正上方 */}
        {/* <CsvExportButton
          data={rawDataRows}
          headers={rawDataColumns.map(col => col.key)}
          filename="Subsample_Scatter_Raw_Data.csv"
          sx={{ mb: 2 }}
        >
          Download Raw Data
        </CsvExportButton> */}
        {/* ...General Info和Statistics*/}
       
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', bgcolor: 'background.paper', p: 2.5, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <DescriptionOutlinedIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>General Information</Typography>
          </Stack>
          {legacyGeneralInfo ? (
            // Historical Dimension / Key Focus origin → row layout matching the
            // NCSubsampleScatterBarChart "General Information" pattern: Grid rows, label
            // left / value right-aligned bold, no dividers; long text fields get a
            // narrower label column (xs=3/9 instead of 5/7).
            <Grid container spacing={1}>
              {[
                { label: 'Period', value: periodRangeDisplay },
                { label: 'Dept', value: selectedData?.Dept ?? '-' },
                { label: 'MachineId', value: selectedData?.MachineId ?? '-' },
                { label: 'MaterialDesc', value: selectedData?.MaterialDesc ?? '-', long: true },
                { label: 'DimensionDesc', value: selectedData?.DimensionDesc ?? '-', long: true },
                { label: 'CAT', value: selectedData?.CAT ?? '-' },
              ].map((f) => (
                <Grid container item xs={12} alignItems="top" key={f.label}>
                  <Grid item xs={f.long ? 3 : 5}>
                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'normal', fontSize: 15 }}>{f.label}:</Typography>
                  </Grid>
                  <Grid item xs={f.long ? 9 : 7}>
                    <Typography variant="body1" sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: 15, wordBreak: 'break-word' }}>{f.value}</Typography>
                  </Grid>
                </Grid>
              ))}
            </Grid>
          ) : (
            // Dimension CPK origin → stat-tile grid mirroring the Statistics panel.
            <Grid container spacing={1.5}>
              {[
                { label: 'Dept', value: selectedData?.Dept ?? '-' },
                { label: 'MachineId', value: selectedData?.MachineId ?? '-' },
                { label: 'CAT', value: selectedData?.CAT ?? '-' },
                { label: 'Period', value: periodRangeDisplay },
                { label: 'MaterialDesc', value: selectedData?.MaterialDesc ?? '-', full: true },
                { label: 'DimensionDesc', value: selectedData?.DimensionDesc ?? '-', full: true },
              ].map((f) => (
                <Grid item xs={f.full ? 12 : 6} key={f.label}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, py: 0.5, px: 1, textAlign: 'center', bgcolor: 'action.hover', height: '100%' }}>
                    <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, lineHeight: 1.3 }}>{f.label}</Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: 16, lineHeight: 1.3, color: 'text.primary', wordBreak: 'break-word' }}>{f.value}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', bgcolor: 'background.paper', p: 2.5, mb: 0, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <QueryStatsIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Statistics</Typography>
          </Stack>
          {legacyGeneralInfo ? (
            // Historical Dimension / Key Focus: Statistics follows the General
            // Information row layout (label left, value right-aligned bold).
            <Grid container spacing={1}>
              {[
                { label: 'No of Data', value: statisticsToShow?.Count ?? allData.length ?? '-' },
                { label: 'Mean', value: statisticsToShow?.MeanValue ?? '-' },
                { label: 'Std Dev', value: statisticsToShow?.StdValue != null ? Number(statisticsToShow.StdValue).toFixed(3) : '-' },
                { label: 'LSL', value: allData[0]?.LSL ?? '-' },
                { label: 'USL', value: allData[0]?.USL ?? '-' },
                { label: 'Target', value: targetValue },
                { label: 'CP', value: statisticsToShow?.CPValue ?? '-', color: statMetricColor(statisticsToShow?.CPValue) },
                { label: 'CPK', value: statisticsToShow?.CPKValue ?? '-', color: statMetricColor(statisticsToShow?.CPKValue) },
                { label: 'PP', value: statisticsToShow?.PPValue ?? '-', color: statMetricColor(statisticsToShow?.PPValue) },
                { label: 'PPK', value: statisticsToShow?.PPKValue ?? '-', color: statMetricColor(statisticsToShow?.PPKValue) },
              ].map((s) => (
                <Grid container item xs={12} alignItems="top" key={s.label}>
                  <Grid item xs={5}>
                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 'normal', fontSize: 15 }}>{s.label}:</Typography>
                  </Grid>
                  <Grid item xs={7}>
                    <Typography variant="body1" sx={{ textAlign: 'right', fontWeight: 'bold', fontSize: 15, wordBreak: 'break-word', color: s.color || 'text.primary' }}>{s.value}</Typography>
                  </Grid>
                </Grid>
              ))}
            </Grid>
          ) : (
          <Grid container spacing={1.5}>
            {[
              { label: 'No of Data', value: statisticsToShow?.Count ?? allData.length ?? '-' },
              { label: 'Mean', value: statisticsToShow?.MeanValue ?? '-' },
              { label: 'Std Dev', value: statisticsToShow?.StdValue != null ? Number(statisticsToShow.StdValue).toFixed(3) : '-' },
              { label: 'LSL', value: allData[0]?.LSL ?? '-' },
              { label: 'USL', value: allData[0]?.USL ?? '-' },
              { label: 'Target', value: targetValue },
              { label: 'CP', value: statisticsToShow?.CPValue ?? '-', color: statMetricColor(statisticsToShow?.CPValue) },
              { label: 'CPK', value: statisticsToShow?.CPKValue ?? '-', color: statMetricColor(statisticsToShow?.CPKValue) },
              { label: 'PP', value: statisticsToShow?.PPValue ?? '-', color: statMetricColor(statisticsToShow?.PPValue) },
            ].map((s) => (
              <Grid item xs={4} key={s.label}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.25, textAlign: 'center', bgcolor: 'action.hover', height: '100%' }}>
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}>{s.label}:</Typography>
                  <Typography sx={{ fontSize: 20, fontWeight: 'bold', mt: 0.25, color: s.color || 'text.primary' }}>{s.value}</Typography>
                </Box>
              </Grid>
            ))}
            <Grid item xs={12}>
              {(() => {
                const v = Number(statisticsToShow?.PPKValue);
                const has = statisticsToShow?.PPKValue !== undefined && statisticsToShow?.PPKValue !== null && !isNaN(v);
                const status = !has
                  ? { c: 'text.secondary', tint: 'action.hover', label: '' }
                  : v >= 1.33
                    ? { c: 'success.main', tint: 'rgba(46,125,50,0.12)', label: 'On Target (≥ 1.33)' }
                    : v >= 1.0
                      ? { c: 'warning.main', tint: 'rgba(237,108,2,0.14)', label: 'Marginal (1.00 – 1.33)' }
                      : { c: 'error.main', tint: 'rgba(211,47,47,0.12)', label: 'Below Target (< 1.00)' };
                return (
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5, textAlign: 'center', bgcolor: 'action.hover' }}>
                    <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontWeight: 600 }}>PPK:</Typography>
                    <Typography sx={{ fontSize: 28, fontWeight: 'bold', color: status.c }}>{has ? statisticsToShow.PPKValue : '-'}</Typography>
                    {status.label && (
                      <Box sx={{ display: 'inline-block', mt: 0.75, px: 1.5, py: 0.25, borderRadius: 5, bgcolor: status.tint, color: status.c, fontSize: 12, fontWeight: 700 }}>
                        {status.label}
                      </Box>
                    )}
                  </Box>
                );
              })()}
            </Grid>
          </Grid>
          )}
        </Box>
      </Grid>
    </Grid>
  )}
      {/* 原始数据弹窗（完全仿照用户示例） */}
      {openRawData && (
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
          onClick={() => setOpenRawData(false)}
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
              <Typography variant="h4" sx={{ fontWeight: 700 }}>{rawDataTitle}</Typography>
              <Button variant="outlined" sx={{ fontSize: 13, px: 3, py: 1 }} onClick={() => setOpenRawData(false)}>Close</Button>
            </Box>
            {/* MUI Table with Ranking */}
            <Box sx={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr style={{ background: '#1a237e' }}>
                    <th style={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}></th>
                    {rawDataColumns.map(col => (
                      <th key={col.key} style={{ fontWeight: 'bold', background: '#1a237e', color: 'white', fontSize: 15 }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawDataRows && rawDataRows.length > 0 ? rawDataRows.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: 15 }}>{idx + 1}</td>
                      {rawDataColumns.map(col => (
                        <td key={col.key} style={{ fontSize: 15 }}>{item[col.key] ?? '-'}</td>
                      ))}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={rawDataColumns.length + 1} align="center" style={{ padding: 24, fontSize: 15 }}>No data</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Box>
          </Box>
        </Box>
      )}

    </Box>
  );
}

export default SubsampleScatterDistribution;