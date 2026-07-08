import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import TableSortLabel from '@mui/material/TableSortLabel';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, circularProgressClasses, useTheme, TextField, InputAdornment, TablePagination } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import axios from 'axios';
import Plot from 'react-plotly.js';
import { Height } from '@mui/icons-material';
import CsvExportButton, { buildExportFilename } from '../CsvExportButton';
import { compareLotNoLast7 } from '../../utils/lotNo';
import { PieChart } from '@mui/x-charts/PieChart';
import dayjs from 'dayjs';
import * as d3 from 'd3-array';
// 新增组件：无row.LotNo时自动查找所有individual lot
import useDrilldownNavigate from '../../utils/useDrilldownNavigate';
import InsightsIcon from '@mui/icons-material/Insights';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
// Icons for the legacy row-style General Information (Historical Dimension / Key Focus origin).
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import GroupsIcon from '@mui/icons-material/Groups';
import MemoryIcon from '@mui/icons-material/Memory';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import StraightenIcon from '@mui/icons-material/Straighten';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';

// 最简 Minitab 正态曲线（100% 正确）
const generateMinitabNormalCurve = (values, bins = 20) => {
  if (!values || values.length < 3) return [];

  const mean = d3.mean(values);
  const std = d3.deviation(values);

  const min = Math.min(...values);
  const max = Math.max(...values);

  // histogram bin width — Minitab scaling 必须要这个
  const binWidth = (max - min) / bins;
  const n = values.length;

  const xMin = mean - 4 * std;
  const xMax = mean + 4 * std;

  const steps = 200;
  const xs = Array.from({ length: steps }, (_, i) =>
    xMin + ((xMax - xMin) * i) / (steps - 1)
  );

  const pdf = x =>
    (1 / (std * Math.sqrt(2 * Math.PI))) *
    Math.exp(-(Math.pow(x - mean, 2) / (2 * std * std)));

  // ⭐⭐ Minitab 的正确 scaling：pdf * N * binWidth
  return xs.map(x => ({
    x,
    y: pdf(x) * n * binWidth,
  }));
};

const parseSpecNumber = (value) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

const isVisibleLSL = (value) => value !== null && value >= -999;
const isVisibleUSL = (value) => value !== null && value < 999;

const roundForPlotly = (value) => Number(value.toPrecision(12));

const getSpecAlignedHistogramConfig = (values, lsl, usl, specBinCount = 20) => {
  const numericValues = (values || []).filter(Number.isFinite);
  if (numericValues.length === 0) return null;

  const hasLSL = isVisibleLSL(lsl);
  const hasUSL = isVisibleUSL(usl);
  if (!hasLSL || !hasUSL) return null;

  const EPSILON = 1e-9;
  if (usl <= lsl + EPSILON) return null;

  const dataMin = Math.min(...numericValues);
  const dataMax = Math.max(...numericValues);
  const binSize = (usl - lsl) / specBinCount;
  if (!Number.isFinite(binSize) || binSize <= EPSILON) return null;

  const minStep = Math.floor((dataMin - lsl) / binSize);
  const maxStep = Math.ceil((dataMax - lsl) / binSize);

  const start = roundForPlotly(lsl + minStep * binSize);
  const rawEnd = lsl + maxStep * binSize;
  const end = roundForPlotly(rawEnd <= start ? start + binSize : rawEnd);

  return {
    autobinx: false,
    xbins: {
      start,
      end,
      size: roundForPlotly(binSize),
    },
  };
};

const HistogramComponent = ({ tableData, LSL, USL }) => {
    const containerRef = useRef(null);
    const [plotWidth, setPlotWidth] = useState(700);
    const [plotHeight, setPlotHeight] = useState(550);

    useEffect(() => {
        function handleResize() {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                setPlotWidth(width);
                setPlotHeight(Math.round(width * 0.6)); // 这里0.6是高宽比，比如16:9可用0.5625
            }
        }
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const xData = tableData.map((item) => parseFloat(item.MeasValue));
    const parsedLSL = parseSpecNumber(LSL);
    const parsedUSL = parseSpecNumber(USL);
    const hasLSL = isVisibleLSL(parsedLSL);
    const hasUSL = isVisibleUSL(parsedUSL);
    const target = hasLSL && hasUSL ? (parsedLSL + parsedUSL) / 2 : null;
    const histogramBinConfig = getSpecAlignedHistogramConfig(xData, parsedLSL, parsedUSL, 20);

    const data = [
      {
        x: xData,
        type: 'histogram',
        ...(histogramBinConfig || {}),
        marker: {
          color: 'blue',
          line: {
            color: 'black',
            width: 2,
          },
        },
      },
    ];

    // shapes和annotations生成逻辑
    const shapes = [];
    const annotations = [];

    if (hasLSL) {
        shapes.push({
            type: 'line',
        x0: parsedLSL,
        x1: parsedLSL,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { dash: 'dot', color: '#F54D41', width: 2 },
        });
        annotations.push({
        x: parsedLSL,
            y: 1.05, yanchor: 'bottom',
            xref: 'x',
            yref: 'paper',
            text: 'LSL',
            showarrow: false,
            font: { color: '#F54D41', size: 18 },
        });
    }

    if (hasUSL) {
        shapes.push({
            type: 'line',
        x0: parsedUSL,
        x1: parsedUSL,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { dash: 'dot', color: '#F54D41', width: 2 },
        });
        annotations.push({
        x: parsedUSL,
            y: 1.05, yanchor: 'bottom',
            xref: 'x',
            yref: 'paper',
            text: 'USL',
            showarrow: false,
            font: { color: '#F54D41', size: 18 },
        });
    }

    // target线和注释，只有LSL和USL都有才出现
    if (hasLSL && hasUSL && target !== null) {
        shapes.push({
            type: 'line',
            x0: target,
            x1: target,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { dash: 'dot', color: 'green', width: 2 },
        });
        annotations.push({
            x: target,
            y: 1.05, yanchor: 'bottom',
            xref: 'x',
            yref: 'paper',
            text: 'Target',
            showarrow: false,
            font: { color: 'green', size: 18 },
        });
    }

    const layout = {
        xaxis: {
            title: {
                text: 'MeasValue',
                font: { size: 22 },
            },
            tickfont: { size: 18 },
        },
        yaxis: {
            title: {
                text: 'Count',
                font: { size: 22 },
            },
            tickfont: { size: 18 },
        },
        width: plotWidth,
        height: plotHeight,
        margin: { t: 80, l: 70, r: 30, b: 100 },
        shapes,
        annotations,
    };

  return (
    <Box ref={containerRef} sx={{ width: '100%', maxWidth: 900 }}>
      <Plot
        data={data}
        layout={layout}
        config={{ displayModeBar: false, responsive: false }}
        style={{ width: '100%', height: plotHeight }}
      />
    </Box>
  );
};

const IndividualLotTableGeneralInfo = ({ row, Period, pieFilter, subsampleData, statistics, lotDataFilename, subsampleFilename }) => {
  const MAX_NC = 0.9949; // CP低于等于该值时标红
  const [loading, setLoading] = useState(false);
  const [lotData, setLotData] = useState([]);
  const drill = useDrilldownNavigate();
  useEffect(() => {
    if (!row || !Period) return;
    const fetchLots = async () => {
      setLoading(true);
      try {
        const filter = {
          Dept: row.Dept,
          MachineId: row.MachineId,
          MaterialDesc: row.MaterialDesc,
          DimensionDesc: row.DimensionDesc,
          CAT: row.CAT,
          Period: Period,
        };
        const response = await axios.post(`${window.baseURL}/unified-data`, {
          DataType: 'IndividualLot',
          Filter: filter,
        });
        setLotData(response.data || []);
      } catch (e) {
        setLotData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchLots();
  }, [row, Period]);

  // 应用 pieFilter 过滤
  const filteredLotData = React.useMemo(() => {
    // BRD H3: sort LotNo ascending by its last 7 digits (e.g. 2603_005).
    const last7 = (lotNo) => String(lotNo || '').replace(/\D/g, '').slice(-7);
    return lotData.filter(item => {
      let pass = true;
      if (pieFilter?.CarbonizingFurnace) {
        pass = pass && item.CarbonizingFurnace === pieFilter.CarbonizingFurnace;
      }
      if (pieFilter?.TemperingFurnace) {
        pass = pass && item.TemperingFurnace === pieFilter.TemperingFurnace;
      }
      return pass;
    }).sort((a, b) => last7(a.LotNo).localeCompare(last7(b.LotNo)));
  }, [lotData, pieFilter]);

  const [search, setSearch] = useState('');
  const [orderBy, setOrderBy] = useState('');
  const [order, setOrder] = useState('asc');

  const handleSort = (col) => {
    if (orderBy === col) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(col);
      setOrder('asc');
    }
  };

  // Search (by LotNo) + column sort applied on top of the pie-filtered data.
  const displayLotData = React.useMemo(() => {
    let data = filteredLotData;
    const q = search.trim().toLowerCase();
    if (q) data = data.filter(item => String(item.LotNo || '').toLowerCase().includes(q));
    if (orderBy) {
      const numeric = ['NO_OF_DATA', 'CPK', 'CP'];
      data = [...data].sort((a, b) => {
        let av = a[orderBy];
        let bv = b[orderBy];
        if (orderBy === 'MeasDate') {
          av = new Date(av).getTime() || 0;
          bv = new Date(bv).getTime() || 0;
          return order === 'asc' ? av - bv : bv - av;
        }
        if (numeric.includes(orderBy)) {
          av = parseFloat(av); bv = parseFloat(bv);
          if (isNaN(av)) av = -Infinity;
          if (isNaN(bv)) bv = -Infinity;
          return order === 'asc' ? av - bv : bv - av;
        }
        if (orderBy === 'LotNo') {
          return order === 'asc' ? compareLotNoLast7(a.LotNo, b.LotNo) : compareLotNoLast7(b.LotNo, a.LotNo);
        }
        av = String(av ?? ''); bv = String(bv ?? '');
        return order === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return data;
  }, [filteredLotData, search, orderBy, order]);

  return (
    <>
      {/* Header: title + note (left) and download buttons (right) on a single line */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 0.5 }}>Individual Lot List</Typography>
          <Typography variant="body2" sx={{ color: 'primary.main', fontStyle: 'italic', letterSpacing: 0.3, mb: 0 }}>
            ⓘ Click a table row to view details.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', flexShrink: 0 }}>
            <CsvExportButton
              data={filteredLotData.map(item => ({
                Dept: row?.Dept ?? '',
                MachineId: row?.MachineId ?? '',
                MaterialDesc: row?.MaterialDesc ?? '',
                DimensionDesc: row?.DimensionDesc ?? '',
                CAT: row?.CAT ?? '',
                ...item,
              }))}
              headers={[
                'Dept',
                'MachineId',
                'MaterialDesc',
                'DimensionDesc',
                'CAT',
                'LotNo',
                'MeasDate',
                'NO_OF_DATA',
                'CarbonizingFurnace',
                'TemperingFurnace',
                'CPK',
                'CP',
              ]}
              generalInfo={[
                { label: 'Report', value: 'Subsample Distribution — Lot Data' },
                { label: 'Period', value: Period },
                { label: 'Dept', value: row?.Dept || '' },
                { label: 'MachineId', value: row?.MachineId || '' },
                { label: 'MaterialDesc', value: row?.MaterialDesc || '' },
                { label: 'DimensionDesc', value: row?.DimensionDesc || '' },
                { label: 'CAT', value: row?.CAT || '' },
              ]}
              statistics={statistics}
              filename={lotDataFilename ?? buildExportFilename(row?.MaterialDesc, Period, 'Lot_Data')}
            >
              Download Lot Data
            </CsvExportButton>
            <CsvExportButton
              data={subsampleData.map(item => ({
                Dept: row?.Dept ?? '',
                MachineId: row?.MachineId ?? '',
                MaterialDesc: row?.MaterialDesc ?? '',
                DimensionDesc: row?.DimensionDesc ?? '',
                CAT: row?.CAT ?? '',
                ...item,
              }))}
              headers={[
                'Dept',
                'MachineId',
                'MaterialDesc',
                'DimensionDesc',
                'CAT',
                'LotNo',
                'CarbonizingFurnace',
                'TemperingFurnace',
                'SubSampleNo',
                'MeasValue',
                'MeasDate'
              ]}
              generalInfo={[
                { label: 'Report', value: 'Subsample Distribution — Raw Data' },
                { label: 'Period', value: Period },
                { label: 'Dept', value: row?.Dept || '' },
                { label: 'MachineId', value: row?.MachineId || '' },
                { label: 'MaterialDesc', value: row?.MaterialDesc || '' },
                { label: 'DimensionDesc', value: row?.DimensionDesc || '' },
                { label: 'CAT', value: row?.CAT || '' },
              ]}
              statistics={statistics}
              filename={subsampleFilename ?? buildExportFilename(row?.MaterialDesc, Period, 'Subsample_Data')}
            >
              Download Subsample Data
            </CsvExportButton>
            <TextField
              size="small"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 220 }}
            />
        </Box>
      </Box>
      {loading ? (
        <CircularProgress />
      ) : (
          <TableContainer component={Paper} sx={{ width: '100%', maxWidth: '100%', maxHeight: 320, overflow: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {[
                    { id: 'LotNo', label: 'LotNo' },
                    { id: 'MeasDate', label: 'MeasDate' },
                    { id: 'NO_OF_DATA', label: 'No of Data' },
                    { id: 'CarbonizingFurnace', label: 'CarburizingFurnace' },
                    { id: 'TemperingFurnace', label: 'TemperingFurnace' },
                    { id: 'CPK', label: 'CPK' },
                    { id: 'CP', label: 'CP' },
                  ].map((col) => (
                    <TableCell key={col.id} sx={{ fontWeight: 'bold' }} sortDirection={orderBy === col.id ? order : false}>
                      <TableSortLabel
                        active={orderBy === col.id}
                        direction={orderBy === col.id ? order : 'asc'}
                        onClick={() => handleSort(col.id)}
                      >
                        {col.label}
                      </TableSortLabel>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {displayLotData.length > 0 ? displayLotData.map((item, idx) => (
                  <TableRow key={idx}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      drill('lots-sample-distribution-table', {
                        state: {
                          row: item,
                          displayPP: false,
                        },
                        replace: false,
                      });
                    }}
                  >
                    <TableCell>{item.LotNo ?? '-'}</TableCell>
                    <TableCell>{dayjs(item.MeasDate).format("MMM D, YYYY") ?? '-'}</TableCell>
                    <TableCell>{item.NO_OF_DATA ?? '-'}</TableCell>
                    <TableCell>{item.CarbonizingFurnace ?? '-'}</TableCell>
                    <TableCell>{item.TemperingFurnace ?? '-'}</TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: parseFloat(item.CPK) <= MAX_NC ? '#F54D41' : 'inherit',
                        color: parseFloat(item.CPK) <= MAX_NC ? 'white' : 'inherit',
                      }}>{item.CPK !== undefined && item.CPK !== null && !isNaN(item.CPK) ? Number(item.CPK).toFixed(3) : item.CPK ?? '-'}</TableCell>
                    <TableCell
                      sx={{
                        backgroundColor: parseFloat(item.CP) <= MAX_NC ? '#F54D41' : 'inherit',
                        color: parseFloat(item.CP) <= MAX_NC ? 'white' : 'inherit',
                      }}>{item.CP !== undefined && item.CP !== null && !isNaN(item.CP) ? Number(item.CP).toFixed(3) : item.CP ?? '-'}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={8} align="center">No data available</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
      )}
    </>
  );
};

const colorList = [
    '#1976d2', '#388e3c', '#fbc02d', '#d32f2f', '#7b1fa2', '#0288d1', '#c2185b', '#ffa000', '#388e3c', '#f57c00'
];

const getPieData = (tableData, key, colorList) => {
    const counts = {};
    tableData.forEach(item => {
        const val = item[key] ?? 'Unknown';
        counts[val] = (counts[val] || 0) + 1;
    });
    const keys = Object.keys(counts).sort();
    return keys.map((label, idx) => ({
        label,
        value: counts[label],
        color: colorList[idx % colorList.length],
    }));
};

const HistogramAndPie = ({
    tableData,
    LSL,
    USL,
    carbPieData,
    tempPieData,
    pieFilter,
    setPieFilter,
    displayPP,
    showHistogram = true,
    showPies = true,
}) => {
    const theme = useTheme();
    const containerRef = useRef(null);
    const [plotWidth, setPlotWidth] = useState(700);
    const [plotHeight, setPlotHeight] = useState(550);

    useEffect(() => {
        function handleResize() {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                setPlotWidth(width);
                setPlotHeight(displayPP ? Math.round(width * 0.72) : Math.min(Math.round(width * 0.42), 360));
            }
        }
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const parsedLSL = parseSpecNumber(LSL);
    const parsedUSL = parseSpecNumber(USL);
    const hasLSL = isVisibleLSL(parsedLSL);
    const hasUSL = isVisibleUSL(parsedUSL);

    // shapes和annotations生成逻辑
    const shapes = [];
    const annotations = [];

    if (hasLSL) {
        shapes.push({
            type: 'line',
        x0: parsedLSL,
        x1: parsedLSL,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { dash: 'dot', color: '#F54D41', width: 2 },
        });
        annotations.push({
        x: parsedLSL,
            y: 1.05, yanchor: 'bottom',
            xref: 'x',
            yref: 'paper',
            text: 'LSL',
            showarrow: false,
            font: { color: '#F54D41', size: 18 },
        });
    }

    if (hasUSL) {
        shapes.push({
            type: 'line',
        x0: parsedUSL,
        x1: parsedUSL,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { dash: 'dot', color: '#F54D41', width: 2 },
        });
        annotations.push({
        x: parsedUSL,
            y: 1.05, yanchor: 'bottom',
            xref: 'x',
            yref: 'paper',
            text: 'USL',
            showarrow: false,
            font: { color: '#F54D41', size: 18 },
        });
    }

    // 添加目标线 (Target line)
    const target = hasLSL && hasUSL ? (parsedLSL + parsedUSL) / 2 : null;
    if (target !== null) {
        shapes.push({
            type: 'line',
            x0: target,
            x1: target,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { dash: 'dot', color: 'green', width: 2 },
        });
        annotations.push({
            x: target,
            y: 1.05, yanchor: 'bottom',
            xref: 'x',
            yref: 'paper',
            text: 'Target',
            showarrow: false,
            font: { color: 'green', size: 18 },
        });
    }

    // === 使用高级 Minitab 标准正态分布曲线 (Normal Fit) ===

const yValues = React.useMemo(() => {
    return tableData.map(item => Number(item.MeasValue)).filter(v => !isNaN(v));
}, [tableData]);

const curve = React.useMemo(() => {
    return generateMinitabNormalCurve(yValues, 20);
}, [yValues]);

const xData = React.useMemo(() => {
  return tableData.map((item) => parseFloat(item.MeasValue)).filter(Number.isFinite);
}, [tableData]);

const histogramBinConfig = React.useMemo(() => {
  return getSpecAlignedHistogramConfig(xData, parsedLSL, parsedUSL, 20);
}, [xData, parsedLSL, parsedUSL]);


    const layout = {
        // Inherit the page/card background (transparent) and use theme text/grid
        // colours so the chart matches light and dark mode instead of a fixed white.
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: theme.palette.text.primary },
        xaxis: {
            title: {
                text: 'MeasValue',
                font: { size: 22, color: theme.palette.text.primary },
            },
            tickfont: { size: 18, color: theme.palette.text.secondary },
            gridcolor: theme.palette.divider,
            linecolor: theme.palette.divider,
            zerolinecolor: theme.palette.divider,
        },
        yaxis: {
            title: {
                text: 'Count',
                font: { size: 22, color: theme.palette.text.primary },
            },
            tickfont: { size: 18, color: theme.palette.text.secondary },
            gridcolor: theme.palette.divider,
            linecolor: theme.palette.divider,
            zerolinecolor: theme.palette.divider,
        },
        width: plotWidth,
        height: plotHeight,
        margin: { t: 80, l: 70, r: 30, b: 100 },
        shapes,
        annotations,
    };

    return (
        <Box ref={containerRef} sx={{ width: '100%', maxWidth: 900 }}>
            {showHistogram && (
            <Plot
          data={[
            // Histogram
            {
                x: xData,
                type: 'histogram',
                ...(histogramBinConfig || {}),
                marker: {
                  color: theme.palette.primary.main,
                  line: { color: theme.palette.background.paper, width: 1.5 },
                },
              },

            // // --- Normal Fit 主曲线 ---
            // {
            //   x: curve.map(d => d.x),
            //   y: curve.map(d => d.y),
            //   type: "scatter",
            //   mode: "lines",
            //   name: "Normal Fit",
            //   line: { color: "#FF5733", width: 3 },
            // },
          ]}
                layout={layout}
                config={{ displayModeBar: false, responsive: false }}
                style={{ width: '100%', height: plotHeight }}
            />
            )}
            {/* Furnace pie charts (rendered on the right column via showHistogram=false) */}
            {displayPP && showPies && (
            <Box sx={{ mt: showHistogram ? 3 : 0, display: 'flex', flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
                {/* CarbonizingFurnace Pie */}
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', textAlign: 'center' }}>
                        Carburizing Furnace (TVC)
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Box sx={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PieChart
                            series={[{
                                data: carbPieData.length ? carbPieData : [{ label: 'No Data', value: 1, color: '#E0E0E0' }],
                                highlightScope: { faded: 'global', highlighted: 'item' },
                                cornerRadius: 6,
                                paddingAngle: 2,
                                innerRadius: 48,
                                outerRadius: 74,
                                cx: 80,
                                cy: 80,
                            }]}
                            legend={{ hidden: true }}
                            width={160}
                            height={160}
                        />
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <Typography sx={{ fontWeight: 'bold', fontSize: 26, lineHeight: 1 }}>
                            {carbPieData.reduce((s, d) => s + (Number(d.value) || 0), 0)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>(100%)</Typography>
                        </Box>
                    </Box>
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                    }}>
                        {pieFilter.CarbonizingFurnace ? (
                            <Box
                                key={pieFilter.CarbonizingFurnace}
                                sx={{
                                    cursor: 'pointer',
                                    px: 1,
                                    py: 1,
                                    borderRadius: 1,
                                    background: carbPieData.find(item => item.label === pieFilter.CarbonizingFurnace)?.color,
                                    color: '#222',
                                    fontWeight: 700,
                                    border: `1px solid ${carbPieData.find(item => item.label === pieFilter.CarbonizingFurnace)?.color}`,
                                    mb: 1,
                                    minWidth: 0,
                                    fontSize: 14,
                                    '&:hover': {
                                        opacity: 0.8
                                    },
                                }}
                                onClick={() => {
                                    setPieFilter(prev => ({
                                        ...prev,
                                        CarbonizingFurnace: null
                                    }));
                                }}
                            >
                                {pieFilter.CarbonizingFurnace} ({carbPieData.find(item => item.label === pieFilter.CarbonizingFurnace)?.value || 0})
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
                                        fontSize: 14,
                                        '&:hover': {
                                            background: item.color,
                                            color: '#222'
                                        },
                                    }}
                                    onClick={() => {
                                        setPieFilter(prev => ({
                                            ...prev,
                                            CarbonizingFurnace: item.label
                                        }));
                                    }}
                                >
                                    {item.label} ({item.value})
                                </Box>
                            ))
                        )}
                    </Box>
                    </Box>
                </Box>
                {/* TemperingFurnace Pie */}
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 15, color: 'text.primary', textAlign: 'center' }}>
                        Tempering Furnace (TAT)
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                    <Box sx={{ position: 'relative', width: 160, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PieChart
                            series={[{
                                data: tempPieData.length ? tempPieData : [{ label: 'No Data', value: 1, color: '#E0E0E0' }],
                                highlightScope: { faded: 'global', highlighted: 'item' },
                                cornerRadius: 6,
                                paddingAngle: 2,
                                innerRadius: 48,
                                outerRadius: 74,
                                cx: 80,
                                cy: 80,
                            }]}
                            legend={{ hidden: true }}
                            width={160}
                            height={160}
                        />
                        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <Typography sx={{ fontWeight: 'bold', fontSize: 26, lineHeight: 1 }}>
                            {tempPieData.reduce((s, d) => s + (Number(d.value) || 0), 0)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>(100%)</Typography>
                        </Box>
                    </Box>
                    <Box sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1,
                        alignItems: 'flex-start',
                        justifyContent: 'flex-start',
                    }}>
                        {pieFilter.TemperingFurnace ? (
                            <Box
                                key={pieFilter.TemperingFurnace}
                                sx={{
                                    cursor: 'pointer',
                                    px: 1,
                                    py: 1,
                                    borderRadius: 1,
                                    background: tempPieData.find(item => item.label === pieFilter.TemperingFurnace)?.color,
                                    color: '#222',
                                    fontWeight: 700,
                                    border: `1px solid ${tempPieData.find(item => item.label === pieFilter.TemperingFurnace)?.color}`,
                                    mb: 1,
                                    minWidth: 0,
                                    fontSize: 14,
                                    '&:hover': {
                                        opacity: 0.8
                                    },
                                }}
                                onClick={() => {
                                    setPieFilter(prev => ({
                                        ...prev,
                                        TemperingFurnace: null
                                    }));
                                }}
                            >
                                {pieFilter.TemperingFurnace} ({tempPieData.find(item => item.label === pieFilter.TemperingFurnace)?.value || 0})
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
                                        fontSize: 14,
                                        '&:hover': {
                                            background: item.color,
                                            color: '#222'
                                        },
                                    }}
                                    onClick={() => {
                                        setPieFilter(prev => ({
                                            ...prev,
                                            TemperingFurnace: item.label
                                        }));
                                    }}
                                >
                                    {item.label} ({item.value})
                                </Box>
                            ))
                        )}
                    </Box>
                    </Box>
                </Box>
            </Box>)}
        </Box>
    );
};


const OverallLotsDistributionTable = () => {
  const location = useLocation();
  // const navigate = useNavigate();
  // This page is shared by all four modules; hierarchical URLs record the origin
  // in the first path segment. Historical Dimension / Key Focus keep the original
  // row-style General Information; Individual / Dimension use the stat-tile grid.
  const originModule = '/' + ((location?.pathname || '').split('/').filter(Boolean)[0] || '');
  const legacyGeneralInfo = originModule === '/lots-historical-summary' || originModule === '/nc-lot-bar';
  const { state } = location || {};
  console.log('OverallLotsDistributionTable state', state);
  const { row } = state || {};
  const { Period } = state || {};
  const { displayPP = true } = state || {};
  const [rawTableData, setRawTableData] = useState([]); // 原始数据
  const [loading, setLoading] = useState(false);
  const [pieFilter, setPieFilter] = useState({ CarbonizingFurnace: null, TemperingFurnace: null });
  const [metrics, setMetrics] = useState(null); // 后端返回的统计量
  const MAX_NC = 0.9949; // CP低于等于该值时标红

  // fetch原始数据
  useEffect(() => {
    if (row) {
      setLoading(true);
      axios.get(`${window.baseURL}/subsamples`, {
        params: {
          LotNo: row.LotNo,
          Period: Period,
          Dept: row.Dept,
          MachineId: row.MachineId,
          MaterialDesc: row.MaterialDesc,
          DimensionDesc: row.DimensionDesc,
          CAT: row.CAT,
        },
      })
        .then(res => {
          setRawTableData(res.data || []);
        })
        .catch(() => setRawTableData([]))
        .finally(() => setLoading(false));
    }
  }, [row, Period]);

  // 前端filter（右侧table也要跟随pieFilter过滤）
  const filteredTableData = React.useMemo(() => {
    return rawTableData.filter(item => {
      let pass = true;
      if (pieFilter.CarbonizingFurnace) {
        pass = pass && item.CarbonizingFurnace === pieFilter.CarbonizingFurnace;
      }
      if (pieFilter.TemperingFurnace) {
        pass = pass && item.TemperingFurnace === pieFilter.TemperingFurnace;
      }
      return pass;
    });
  }, [rawTableData, pieFilter]);

  // Subsample Information table: search + sort + pagination
  const [subSearch, setSubSearch] = useState('');
  const [subOrderBy, setSubOrderBy] = useState('');
  const [subOrder, setSubOrder] = useState('asc');
  const [subPage, setSubPage] = useState(0);
  const [subRowsPerPage, setSubRowsPerPage] = useState(10);

  const handleSubSort = (col) => {
    if (subOrderBy === col) setSubOrder(subOrder === 'asc' ? 'desc' : 'asc');
    else { setSubOrderBy(col); setSubOrder('asc'); }
    setSubPage(0);
  };

  const subsampleProcessed = React.useMemo(() => {
    let data = [...filteredTableData];
    const q = subSearch.trim().toLowerCase();
    if (q) {
      data = data.filter(item =>
        ['LotNo', 'CarbonizingFurnace', 'TemperingFurnace', 'SubSampleNo', 'MeasValue', 'MeasDate']
          .some(k => String(item[k] ?? '').toLowerCase().includes(q))
      );
    }
    if (subOrderBy) {
      const numeric = ['SubSampleNo', 'MeasValue'];
      data.sort((a, b) => {
        let av = a[subOrderBy];
        let bv = b[subOrderBy];
        if (subOrderBy === 'MeasDate') {
          av = new Date(av).getTime() || 0; bv = new Date(bv).getTime() || 0;
          return subOrder === 'asc' ? av - bv : bv - av;
        }
        if (numeric.includes(subOrderBy)) {
          av = parseFloat(av); bv = parseFloat(bv);
          if (isNaN(av)) av = -Infinity; if (isNaN(bv)) bv = -Infinity;
          return subOrder === 'asc' ? av - bv : bv - av;
        }
        if (subOrderBy === 'LotNo') {
          return subOrder === 'asc' ? compareLotNoLast7(a.LotNo, b.LotNo) : compareLotNoLast7(b.LotNo, a.LotNo);
        }
        av = String(av ?? ''); bv = String(bv ?? '');
        return subOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    } else {
      data.sort((a, b) => { const c = compareLotNoLast7(a.LotNo, b.LotNo); return c !== 0 ? c : (a.SubSampleNo || 0) - (b.SubSampleNo || 0); });
    }
    return data;
  }, [filteredTableData, subSearch, subOrderBy, subOrder]);

  // 有效数据（MeasValue 合法），与 Python NO_OF_DATA 基准一致，用于 pie 计算
  const validTableData = React.useMemo(() => {
    return rawTableData.filter(item => {
      const v = parseFloat(item.MeasValue);
      return item.MeasValue !== null && item.MeasValue !== undefined && !isNaN(v);
    });
  }, [rawTableData]);

  // validTableData 经过 pieFilter 后的结果
  const validFilteredTableData = React.useMemo(() => {
    return validTableData.filter(item => {
      let pass = true;
      if (pieFilter.CarbonizingFurnace) pass = pass && item.CarbonizingFurnace === pieFilter.CarbonizingFurnace;
      if (pieFilter.TemperingFurnace) pass = pass && item.TemperingFurnace === pieFilter.TemperingFurnace;
      return pass;
    });
  }, [validTableData, pieFilter]);

  // Linked Filtering: Pie数据基于 validTableData（有效数据），与 NO_OF_DATA 基准一致
  // CarbonizingFurnace Pie 排除 TemperingFurnace 过滤
  const carbPieData = React.useMemo(() => {
    const base = validTableData.filter(item => {
      if (pieFilter.TemperingFurnace) return item.TemperingFurnace === pieFilter.TemperingFurnace;
      return true;
    });
    const pieData = getPieData(base, 'CarbonizingFurnace', colorList);
    if (pieFilter.CarbonizingFurnace) return pieData.filter(item => item.label === pieFilter.CarbonizingFurnace);
    return pieData;
  }, [validTableData, pieFilter.TemperingFurnace, pieFilter.CarbonizingFurnace]);

  // TemperingFurnace Pie 排除 CarbonizingFurnace 过滤
  const tempPieData = React.useMemo(() => {
    const base = validTableData.filter(item => {
      if (pieFilter.CarbonizingFurnace) return item.CarbonizingFurnace === pieFilter.CarbonizingFurnace;
      return true;
    });
    const pieData = getPieData(base, 'TemperingFurnace', colorList);
    if (pieFilter.TemperingFurnace) return pieData.filter(item => item.label === pieFilter.TemperingFurnace);
    return pieData;
  }, [validTableData, pieFilter.CarbonizingFurnace, pieFilter.TemperingFurnace]);

  // metrics计算：Pie filter变化时，调用后端接口
  useEffect(() => {
    if (filteredTableData.length === 0) {
      setMetrics(null);
      return;
    }
    const subData = filteredTableData
        .map(x => ({
          Value: parseFloat(x.MeasValue),
          LotNo: x.LotNo
        }))
        .filter(x => !isNaN(x.Value));

      const lsl = filteredTableData[0]?.LSL;
      const usl = filteredTableData[0]?.USL;

      axios.post(`${window.baseURL}/subsamples/calculate-subsample-metrics`, {
        SubsampleData: JSON.stringify(subData),
        LSL: lsl,
        USL: usl
      })
      .then(res => {setMetrics(res.data?.statisticsValue || null); 
      console.log(res.data);})
      .catch(() => setMetrics(null));
      // console.log('metrics', metrics);
  }, [filteredTableData]);

  const statsLSLRaw = filteredTableData[0]?.LSL;
  const statsUSLRaw = filteredTableData[0]?.USL;
  const statsLSLParsed = parseSpecNumber(statsLSLRaw);
  const statsUSLParsed = parseSpecNumber(statsUSLRaw);
  const statsLSLDisplay = isVisibleLSL(statsLSLParsed) ? statsLSLRaw : '-';
  const statsUSLDisplay = isVisibleUSL(statsUSLParsed) ? statsUSLRaw : '-';

  const formattedPeriod = Period
    ? (typeof Period === 'number' || /^\d{6}$/.test(Period)
        ? (() => {
            const str = String(Period);
            const year = str.slice(0, 4);
            const month = str.slice(4, 6);
            return `${new Date(`${year}-${month}-01`).toLocaleString('en-US', { month: 'short' })} ${year}`;
          })()
        : (Period.length === 7
            ? `${new Date(Period + '-01').toLocaleString('en-US', { month: 'short' })} ${Period.slice(0, 4)}`
            : (Period.length === 10
                ? `${new Date(Period).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}`
                : Period)))
    : '';

  // Historical Dimension passes the selected month range; show it as the Period label
  // (e.g. "Jun 2026 – Aug 2026"). Falls back to the single formatted month otherwise.
  const { periodStart, periodEnd } = state || {};
  const fmtMonthShort = (m) => {
    if (!m) return '';
    const str = String(m).replace('-', '');
    if (!/^\d{6}$/.test(str)) return String(m);
    return `${new Date(`${str.slice(0, 4)}-${str.slice(4, 6)}-01`).toLocaleString('en-US', { month: 'short' })} ${str.slice(0, 4)}`;
  };
  const periodRangeLabel = (periodStart && periodEnd)
    ? `${fmtMonthShort(periodStart)} – ${fmtMonthShort(periodEnd)}`
    : '';
  const periodDisplay = periodRangeLabel || formattedPeriod;

  // BRD H (Individual Lot Cpk): the lot-level general-info date field is the
  // measurement date — labelled "MeasDate" and shown as e.g. "Jan 14, 2026".
  const formattedMeasDate = row?.MeasDate
    ? new Date(row.MeasDate).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    : '';

  // Download filename conventions (BRD):
  //   Individual Lot origin: "<Material>_Individual Lot Subsample Data_<MeasDate>"
  //   Dimension origin:      "<Material>_Dimension Lot Data_<Period>" and
  //                          "<Material>_Dimension Subsample Data_<Period>"
  // Material descriptions can contain filename-invalid chars (e.g. "BC68K/68"),
  // so strip only those and keep spaces to match the requested format.
  const cleanMaterialForFile = String(row?.MaterialDesc || 'Material').replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  const periodLabelForFile = periodDisplay || String(Period || '');
  const measDateForFile = row?.MeasDate ? dayjs(row.MeasDate).format('D MMM YYYY') : periodLabelForFile;
  // Dimension CPK PPK and Historical Dimension drill-ins both use the "Dimension …" naming.
  const isDimensionOrigin = originModule === '/lots-cpk-ppk-bar' || originModule === '/lots-historical-summary';
  const dimensionLotDataFilename = isDimensionOrigin
    ? `${cleanMaterialForFile}_Dimension Lot Data_${periodLabelForFile}.csv`
    : buildExportFilename(row?.MaterialDesc, Period, 'Lot_Data');
  const dimensionSubsampleFilename = isDimensionOrigin
    ? `${cleanMaterialForFile}_Dimension Subsample Data_${periodLabelForFile}.csv`
    : buildExportFilename(row?.MaterialDesc, Period, 'Subsample_Data');
  const individualLotSubsampleFilename = originModule === '/lot-cpk-bar'
    ? `${cleanMaterialForFile}_Individual Lot Subsample Data_${measDateForFile}.csv`
    : dimensionSubsampleFilename;

  // BRD (Individual Lot Cpk & Dimension Cpk Ppk): the exported file carries a
  // "Statistics" block (one field per row) alongside "General Information".
  // Mirrors the on-screen Statistics panel. Pp/Ppk only when displayPP (Dimension).
  const fmtMetric = (v) => (v != null && !isNaN(v)) ? Number(v).toFixed(3) : (v ?? '-');
  const statisticsForExport = [
    { label: 'No of Data', value: (pieFilter.CarbonizingFurnace || pieFilter.TemperingFurnace) ? validFilteredTableData.length : (row?.NO_OF_DATA ?? '-') },
    { label: 'Mean', value: metrics?.MeanValue ?? '-' },
    { label: 'Std Dev', value: metrics?.StdValue ?? '-' },
    { label: 'LSL', value: statsLSLDisplay },
    { label: 'USL', value: statsUSLDisplay },
    { label: 'Target', value: (isVisibleLSL(statsLSLParsed) && isVisibleUSL(statsUSLParsed)) ? ((statsLSLParsed + statsUSLParsed) / 2) : '-' },
    { label: 'Cp', value: fmtMetric(metrics?.CPValue) },
    { label: 'Cpk', value: fmtMetric(metrics?.CPKValue) },
    ...(displayPP ? [
      { label: 'Pp', value: fmtMetric(metrics?.PPValue) },
      { label: 'Ppk', value: fmtMetric(metrics?.PPKValue) },
    ] : []),
  ];

  return (
    <Box sx={{
        p: { xs: 2, md: 3 },
        width: '100%',
        boxSizing: 'border-box',
      }}
      >
      <Grid container spacing={3}>
        {/* 左侧块 */}
        <Grid item xs={12} md={6}>
          <Box sx={{ width: '100%', boxSizing: 'border-box' }}>
            {/* Histogram */}
          <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', height: '100%', boxSizing: 'border-box' }}>
            <Typography variant="h6" gutterBottom>
              Subsample Distribution Histogram
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
              </Box>
            ) : filteredTableData.length > 0 ? (
              <HistogramAndPie
                tableData={filteredTableData}
                LSL={filteredTableData[0].LSL}
                USL={filteredTableData[0].USL}
                displayPP={displayPP}
                carbPieData={carbPieData}
                tempPieData={tempPieData}
                pieFilter={pieFilter}
                setPieFilter={setPieFilter}
                showPies={false}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">No data available</Typography>
            )}
          </Box>
          </Box>
        </Grid>
        {/* 右侧块 */}
        <Grid item xs={12} md={6}>
          {/* General Information + Statistics (top of right column) */}
          <Grid container spacing={3} sx={{ mb: displayPP ? 3 : 0, height: displayPP ? undefined : '100%' }}>
            <Grid item xs={12} sm={7}>
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <InsightsIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                    {row?.LotNo ? 'Individual Lot' : 'Dimension'} General Information
                  </Typography>
                </Box>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                    <CircularProgress />
                  </Box>
                ) : (() => {
                  // One field list, two renderings. `full` marks long text fields that span
                  // the whole width in the tile layout; the icon is used only by the legacy
                  // row layout. Short fields first so tiles pair without gaps.
                  const fields = [
                    row?.LotNo && { icon: <LocalOfferIcon fontSize="small" />, label: 'LotNo', value: row.LotNo, full: true },
                    (row?.LotNo
                      ? (formattedMeasDate && { icon: <CalendarMonthIcon fontSize="small" />, label: 'MeasDate', value: formattedMeasDate })
                      : (Period && { icon: <CalendarMonthIcon fontSize="small" />, label: 'Period', value: periodDisplay })),
                    row?.Dept && { icon: <GroupsIcon fontSize="small" />, label: 'Dept', value: row.Dept },
                    row?.MachineId && { icon: <MemoryIcon fontSize="small" />, label: 'MachineId', value: row.MachineId },
                    row?.CAT && { icon: <LocalOfferIcon fontSize="small" />, label: 'CAT', value: row.CAT },
                    // No Of Data is omitted — redundant with the Statistics panel's "No of Data" tile.
                    row?.MaterialDesc && { icon: <Inventory2Icon fontSize="small" />, label: 'MaterialDesc', value: row.MaterialDesc, full: true },
                    row?.DimensionDesc && { icon: <StraightenIcon fontSize="small" />, label: 'DimensionDesc', value: row.DimensionDesc, full: true },
                  ].filter(Boolean);

                  // Historical Dimension / Key Focus origin → legacy row layout.
                  return legacyGeneralInfo ? (
                    <Box>
                      {fields.map((f, i, arr) => (
                        <Box key={f.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.9, borderBottom: i < arr.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                          <Box sx={{ color: 'text.secondary', display: 'flex' }}>{f.icon}</Box>
                          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{f.label}:</Typography>
                          <Typography sx={{ ml: 'auto', fontWeight: 'bold', fontSize: 14, textAlign: 'right', wordBreak: 'break-word' }}>{f.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    // Individual / Dimension origin → stat-tile grid mirroring the Statistics panel.
                    <Grid container spacing={1}>
                      {fields.map((f) => (
                        <Grid item xs={f.full ? 12 : 6} key={f.label}>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, py: 0.5, px: 1, textAlign: 'center', bgcolor: 'action.hover', height: '100%' }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, lineHeight: 1.3 }}>{f.label}</Typography>
                            <Typography sx={{ fontWeight: 'bold', fontSize: 16, lineHeight: 1.3, color: 'text.primary', wordBreak: 'break-word' }}>{f.value}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  );
                })()}
              </Box>
            </Grid>
            <Grid item xs={12} sm={5}>
              <Box sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <QueryStatsIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Statistics</Typography>
                </Box>
                {loading || filteredTableData.length === 0 ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}><CircularProgress /></Box>
                ) : (() => {
                  const statsFields = [
                    { label: 'Mean', value: metrics?.MeanValue ?? '-' },
                    { label: 'Std Dev', value: metrics?.StdValue ?? '-' },
                    { label: 'No of Data', value: (pieFilter.CarbonizingFurnace || pieFilter.TemperingFurnace) ? validFilteredTableData.length : (row?.NO_OF_DATA ?? '-') },
                    { label: 'LSL', value: statsLSLDisplay },
                    { label: 'USL', value: statsUSLDisplay },
                    { label: 'Target', value: (isVisibleLSL(statsLSLParsed) && isVisibleUSL(statsUSLParsed)) ? ((statsLSLParsed + statsUSLParsed) / 2) : '-', color: 'success.main' },
                    { label: 'CPK', value: (metrics?.CPKValue != null && !isNaN(metrics?.CPKValue)) ? Number(metrics.CPKValue).toFixed(3) : (metrics?.CPKValue ?? '-'), color: metrics?.CPKValue != null && Number(metrics?.CPKValue) <= MAX_NC ? '#F54D41' : undefined },
                    ...(displayPP ? [{ label: 'PPK', value: (metrics?.PPKValue != null && !isNaN(metrics?.PPKValue)) ? Number(metrics.PPKValue).toFixed(3) : (metrics?.PPKValue ?? '-'), color: metrics?.PPKValue != null && Number(metrics?.PPKValue) <= MAX_NC ? '#F54D41' : undefined }] : []),
                    { label: 'CP', value: (metrics?.CPValue != null && !isNaN(metrics?.CPValue)) ? Number(metrics.CPValue).toFixed(3) : (metrics?.CPValue ?? '-'), color: metrics?.CPValue != null && Number(metrics?.CPValue) <= MAX_NC ? '#F54D41' : undefined },
                    ...(displayPP ? [{ label: 'PP', value: (metrics?.PPValue != null && !isNaN(metrics?.PPValue)) ? Number(metrics.PPValue).toFixed(3) : (metrics?.PPValue ?? '-'), color: metrics?.PPValue != null && Number(metrics?.PPValue) <= MAX_NC ? '#F54D41' : undefined }] : []),
                  ];
                  return legacyGeneralInfo ? (
                    // Historical Dimension / Key Focus: Statistics follows the General
                    // Information row layout (label left, value right-aligned bold).
                    <Box>
                      {statsFields.map((s, i, arr) => (
                        <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.9, borderBottom: i < arr.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
                          <Typography sx={{ color: 'text.secondary', fontSize: 14 }}>{s.label}:</Typography>
                          <Typography sx={{ ml: 'auto', fontWeight: 'bold', fontSize: 14, textAlign: 'right', wordBreak: 'break-word', color: s.color || 'text.primary' }}>{s.value}</Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Grid container spacing={1}>
                      {statsFields.map((s) => (
                        <Grid item xs={6} key={s.label}>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, py: 0.5, px: 1, textAlign: 'center', bgcolor: 'action.hover', height: '100%' }}>
                            <Typography sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600, lineHeight: 1.3 }}>{s.label}</Typography>
                            <Typography sx={{ fontWeight: 'bold', fontSize: 16, lineHeight: 1.3, color: s.color || 'text.primary' }}>{s.value}</Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  );
                })()}
              </Box>
            </Grid>
          </Grid>
          {displayPP && filteredTableData.length > 0 && (
            <Box sx={{ mt: 3, width: '100%', boxSizing: 'border-box', p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
              <Typography variant="h6" gutterBottom sx={{ textAlign: 'center' }}>Furnace Data (Summary)</Typography>
              <HistogramAndPie
                tableData={filteredTableData}
                LSL={filteredTableData[0].LSL}
                USL={filteredTableData[0].USL}
                displayPP={displayPP}
                carbPieData={carbPieData}
                tempPieData={tempPieData}
                pieFilter={pieFilter}
                setPieFilter={setPieFilter}
                showHistogram={false}
              />
            </Box>
          )}
        </Grid>
        {row?.LotNo ? (
        <Grid item xs={12}>
          <Box sx={{ width: '100%', boxSizing: 'border-box', p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Subsample Information
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <CsvExportButton
              data={filteredTableData.map(item => ({
                Dept: row?.Dept ?? '',
                MachineId: row?.MachineId ?? '',
                MaterialDesc: row?.MaterialDesc ?? '',
                DimensionDesc: row?.DimensionDesc ?? '',
                CAT: row?.CAT ?? '',
                ...item,
              }))}
              headers={[
                'Dept',
                'MachineId',
                'MaterialDesc',
                'DimensionDesc',
                'CAT',
                'LotNo',
                'CarbonizingFurnace',
                'TemperingFurnace',
                'SubSampleNo',
                'MeasValue',
                'MeasDate'
              ]}
              generalInfo={[
                { label: 'Report', value: 'Subsample Distribution — Raw Data' },
                { label: 'Period', value: Period },
                { label: 'Dept', value: row?.Dept || '' },
                { label: 'MachineId', value: row?.MachineId || '' },
                { label: 'MaterialDesc', value: row?.MaterialDesc || '' },
                { label: 'DimensionDesc', value: row?.DimensionDesc || '' },
                { label: 'CAT', value: row?.CAT || '' },
              ]}
              statistics={statisticsForExport}
              filename={individualLotSubsampleFilename}
              sx={{ flexShrink: 0, px: 1.5, height: 34, whiteSpace: 'nowrap', textTransform: 'none' }}
              title="Download Subsample Data"
            >
              <DownloadIcon fontSize="small" sx={{ mr: 0.5 }} />
              Download Subsample Data
            </CsvExportButton>
            <TextField
              size="small"
              placeholder="Search…"
              value={subSearch}
              onChange={(e) => { setSubSearch(e.target.value); setSubPage(0); }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} /></InputAdornment>) }}
              sx={{ minWidth: 200, '& .MuiInputBase-root': { height: 34 } }}
            />
            </Box>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
              <TableContainer
                component={Paper}
                sx={{
                  width: '100%',
                  maxWidth: '100%',
                  maxHeight: 420,
                  overflow: 'auto',
                }}
              >
                <Table stickyHeader size="small">
                  <colgroup><col style={{ width: 120 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 160 }} /></colgroup>
                  <TableHead>
                    <TableRow>
                      {[
                        { id: 'LotNo', label: 'LotNo', mw: 100 },
                        { id: 'CarbonizingFurnace', label: 'Carburizing Furnace', mw: 60 },
                        { id: 'TemperingFurnace', label: 'Tempering Furnace', mw: 60 },
                        { id: 'SubSampleNo', label: 'SubSample No', mw: 70 },
                        { id: 'MeasValue', label: 'MeasValue', mw: 80 },
                        { id: 'MeasDate', label: 'MeasDate', mw: 140 },
                      ].map((col) => (
                        <TableCell key={col.id} sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', minWidth: col.mw }} sortDirection={subOrderBy === col.id ? subOrder : false}>
                          <TableSortLabel active={subOrderBy === col.id} direction={subOrderBy === col.id ? subOrder : 'asc'} onClick={() => handleSubSort(col.id)}>
                            {col.label}
                          </TableSortLabel>
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {subsampleProcessed.length > 0 ? (
                      subsampleProcessed
                        .slice(subPage * subRowsPerPage, subPage * subRowsPerPage + subRowsPerPage)
                        .map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>{item.LotNo ?? '-'}</TableCell>
                            <TableCell>{item.CarbonizingFurnace ?? '-'}</TableCell>
                            <TableCell>{item.TemperingFurnace ?? '-'}</TableCell>
                            <TableCell>{item.SubSampleNo ?? '-'}</TableCell>
                            <TableCell>{item.MeasValue || '-'}</TableCell>
                            <TableCell>{dayjs(item.MeasDate).format("MMM D, YYYY") ?? '-'}</TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          No data available
                        </TableCell>
                      </TableRow>
                    )}
                </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={subsampleProcessed.length}
                page={subPage}
                onPageChange={(e, p) => setSubPage(p)}
                rowsPerPage={subRowsPerPage}
                onRowsPerPageChange={(e) => { setSubRowsPerPage(parseInt(e.target.value, 10)); setSubPage(0); }}
                rowsPerPageOptions={[10, 25, 50]}
              />
              </>
            )}
          </Box>
        </Grid>) : null
        }
      {/* Individual Lot List — full-width row at the bottom */}
      {!row?.LotNo && (
        <Grid item xs={12}>
          <Box sx={{ width: '100%', boxSizing: 'border-box', p: 2, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
            <IndividualLotTableGeneralInfo row={row} Period={Period} pieFilter={pieFilter} subsampleData={filteredTableData} statistics={statisticsForExport} lotDataFilename={dimensionLotDataFilename} subsampleFilename={dimensionSubsampleFilename} />
          </Box>
        </Grid>
      )}
      </Grid>
    </Box>
  );
};

export default OverallLotsDistributionTable;