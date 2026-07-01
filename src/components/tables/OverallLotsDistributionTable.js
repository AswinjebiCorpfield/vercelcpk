import React, { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import TableSortLabel from '@mui/material/TableSortLabel';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography, CircularProgress, circularProgressClasses, useTheme } from '@mui/material';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import axios from 'axios';
import Plot from 'react-plotly.js';
import { Height } from '@mui/icons-material';
import CsvExportButton, { buildExportFilename } from '../CsvExportButton';
import { PieChart } from '@mui/x-charts/PieChart';
import dayjs from 'dayjs';
import * as d3 from 'd3-array';
// 新增组件：无row.LotNo时自动查找所有individual lot
import { useNavigate } from 'react-router-dom';

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
            y: 1.05,
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
            y: 1.05,
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
            y: 1.05,
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
        margin: { t: 60, l: 100, r: 80, b: 100 },
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

const IndividualLotTableGeneralInfo = ({ row, Period, pieFilter, subsampleData }) => {
  const MAX_NC = 0.9949; // CP低于等于该值时标红
  const [loading, setLoading] = useState(false);
  const [lotData, setLotData] = useState([]);
  const navigate = useNavigate();
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
                { label: 'Report', value: 'Histogram Distribution — Lot Data' },
                { label: 'MeasDate', value: Period },
                { label: 'Dept', value: row?.Dept || '' },
                { label: 'MachineId', value: row?.MachineId || '' },
                { label: 'MaterialDesc', value: row?.MaterialDesc || '' },
                { label: 'DimensionDesc', value: row?.DimensionDesc || '' },
                { label: 'CAT', value: row?.CAT || '' },
              ]}
              filename={buildExportFilename(row?.MaterialDesc, Period, 'Lot_Data')}
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
                { label: 'Report', value: 'Histogram Distribution — Subsample Data' },
                { label: 'MeasDate', value: Period },
                { label: 'Dept', value: row?.Dept || '' },
                { label: 'MachineId', value: row?.MachineId || '' },
                { label: 'MaterialDesc', value: row?.MaterialDesc || '' },
                { label: 'DimensionDesc', value: row?.DimensionDesc || '' },
                { label: 'CAT', value: row?.CAT || '' },
              ]}
              filename={buildExportFilename(row?.MaterialDesc, Period, 'Subsample_Data')}
            >
              Download Subsample Data
            </CsvExportButton>
        </Box>
      </Box>
      {loading ? (
        <CircularProgress />
      ) : (
          <TableContainer component={Paper} sx={{ width: '100%', maxWidth: '100%', maxHeight: 320, overflow: 'auto' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>LotNo</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>MeasDate</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>No of Data</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>CarburizingFurnace</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>TemperingFurnace</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>CPK</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>CP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredLotData.length > 0 ? filteredLotData.map((item, idx) => (
                  <TableRow key={idx}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      navigate('/lots-sample-distribution-table', {
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
                setPlotHeight(Math.round(width * 0.6));
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
            y: 1.05,
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
            y: 1.05,
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
            y: 1.05,
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
        margin: { t: 60, l: 100, r: 80, b: 100 },
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
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <PieChart
                            series={[{
                                data: carbPieData.length ? carbPieData : [{ label: 'No Data', value: 1, color: '#E0E0E0' }],
                                highlightScope: { faded: 'global', highlighted: 'item' },
                                cornerRadius: 6,
                                paddingAngle: 2,
                                innerRadius: 0,
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
                {/* TemperingFurnace Pie */}
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        <PieChart
                            series={[{
                                data: tempPieData.length ? tempPieData : [{ label: 'No Data', value: 1, color: '#E0E0E0' }],
                                highlightScope: { faded: 'global', highlighted: 'item' },
                                cornerRadius: 6,
                                paddingAngle: 2,
                                innerRadius: 0,
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
            </Box>)}
        </Box>
    );
};


const OverallLotsDistributionTable = () => {
  const location = useLocation();
  // const navigate = useNavigate();
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
            <Grid container spacing={3}>
              {/* General Information */}
              <Grid item xs={12} md={8}>
                <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="h6" gutterBottom>
                    {row?.LotNo ? 'Individual Lot' : 'Dimension'} General Information
                  </Typography>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                  <Grid container spacing={2}>
                    <Grid item xs={4}>
                      {row?.LotNo && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>LotNo:</Typography>}
                      {Period && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>Period:</Typography>}
                      {row?.Dept && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>Dept:</Typography>}
                      {row?.MachineId && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>MachineId:</Typography>}
                      {row?.MaterialDesc && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>MaterialDesc:</Typography>}
                      {row?.DimensionDesc && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>DimensionDesc:</Typography>}
                      {row?.CAT && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>CAT:</Typography>}
                      {row?.NO_OF_DATA && <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>No Of Data:</Typography>}
                    </Grid>
                    <Grid item xs={8}>
                      {row?.LotNo && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{row?.LotNo}</Typography>
                      )}
                      {Period && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {
                            typeof Period === 'number' || /^\d{6}$/.test(Period)
                              ? (() => {
                                  const str = String(Period);
                                  const year = str.slice(0, 4);
                                  const month = str.slice(4, 6);
                                  return `${new Date(`${year}-${month}-01`).toLocaleString('en-US', { month: 'short' })} ${year}`;
                                })()
                              : (
                                  Period.length === 7
                                    ? `${new Date(Period + '-01').toLocaleString('en-US', { month: 'short' })} ${Period.slice(0, 4)}`
                                    : (
                                        Period.length === 10
                                          ? `${new Date(Period).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}`
                                          : Period
                                      )
                              )
                          }
                        </Typography>
                      )}
                      {row?.Dept && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{row.Dept}</Typography>
                      )}
                      {row?.MachineId && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{row.MachineId}</Typography>
                      )}
                      {row?.MaterialDesc && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{row.MaterialDesc}</Typography>
                      )}
                      {row?.DimensionDesc && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{row.DimensionDesc}</Typography>
                      )}
                      {row?.CAT && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{row.CAT}</Typography>
                      )}
                      {row?.NO_OF_DATA && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>
                          {(pieFilter.CarbonizingFurnace || pieFilter.TemperingFurnace)
                            ? validFilteredTableData.length
                            : row.NO_OF_DATA}
                        </Typography>
                      )}
                    </Grid>
                  </Grid>
                  )}
                </Box>
              </Grid>
              {/* Statistics */}
              <Grid item xs={12} md={4}>
                <Box sx={{ p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', height: '100%' }}>
                  <Typography variant="h6" gutterBottom>Statistics</Typography>
                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                      <CircularProgress />
                    </Box>
                  ) : (
                  <Grid container spacing={1}>
                    <Grid item xs={7}>
                      <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>Mean:</Typography>
                      <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>Standard Deviation:</Typography>
                      <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>LSL:</Typography>
                      <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>USL:</Typography>
                      <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>CPK:</Typography>
                      { displayPP &&<Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>PPK:</Typography>}
                      <Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>CP:</Typography>
                      { displayPP &&<Typography sx={{ color: 'text.secondary', fontWeight: 'normal' }}>PP:</Typography>}
                    </Grid>
                    <Grid item xs={5}>
                      {filteredTableData.length === 0 ? (
                      <CircularProgress />
                      ) : (
                        <>
                      <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{metrics?.MeanValue ?? '-'}</Typography>
                      <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{metrics?.StdValue ?? '-'}</Typography>
                      <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{statsLSLDisplay}</Typography>
                      <Typography sx={{ textAlign: 'right', fontWeight: 'bold' }}>{statsUSLDisplay}</Typography>
                      <Typography sx={{ textAlign: 'right', fontWeight: 'bold', color:
                         metrics?.CPKValue != null && Number(metrics?.CPKValue) <= MAX_NC ? '#F54D41' : 'inherit' }}>{metrics?.CPKValue !== undefined && metrics?.CPKValue !== null && !isNaN(metrics?.CPKValue) ? Number(metrics.CPKValue).toFixed(3) : metrics?.CPKValue ?? '-'}</Typography>
                      {displayPP && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold', color:
                        metrics?.PPKValue != null && Number(metrics?.PPKValue) <= MAX_NC ? '#F54D41' : 'inherit' }}>{metrics?.PPKValue !== undefined && metrics?.PPKValue !== null && !isNaN(metrics?.PPKValue) ? Number(metrics.PPKValue).toFixed(3) : metrics?.PPKValue ?? ''}</Typography>
                      )}
                      <Typography sx={{ textAlign: 'right', fontWeight: 'bold', color:
                        metrics?.CPValue != null &&  Number(metrics?.CPValue) <= MAX_NC ? '#F54D41' : 'inherit' }}>{metrics?.CPValue !== undefined && metrics?.CPValue !== null && !isNaN(metrics?.CPValue) ? Number(metrics.CPValue).toFixed(3) : metrics?.CPValue ?? '-'}</Typography>
                      {displayPP && (
                        <Typography sx={{ textAlign: 'right', fontWeight: 'bold', color:
                        metrics?.PPValue != null &&  Number(metrics?.PPValue) <= MAX_NC ? '#F54D41' : 'inherit'
                      }}>
                      {metrics?.PPValue !== undefined && metrics?.PPValue !== null && !isNaN(metrics?.PPValue) ? Number(metrics.PPValue).toFixed(3) : metrics?.PPValue ?? '-'}</Typography>
                      )}
                      </>
                    )}
                    </Grid>
                  </Grid>
                  )}
                </Box>
              </Grid>
            </Grid>
            {/* Histogram */}
          <Box sx={{ marginTop: 3 }}>
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
          {row?.LotNo ? (
          <Box sx={{ width: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
                Subsample Information
              </Typography>
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
                { label: 'MeasDate', value: Period },
                { label: 'Dept', value: row?.Dept || '' },
                { label: 'MachineId', value: row?.MachineId || '' },
                { label: 'MaterialDesc', value: row?.MaterialDesc || '' },
                { label: 'DimensionDesc', value: row?.DimensionDesc || '' },
                { label: 'CAT', value: row?.CAT || '' },
              ]}
              filename={buildExportFilename(row?.MaterialDesc, Period, 'Subsample_Data')}
              sx={{ flexShrink: 0 }}
            >
              Download Subsample Data
            </CsvExportButton>
            </Box>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer
                component={Paper}
                sx={{
                  width: '100%',
                  maxWidth: '100%',
                  overflowX: 'auto',
                }}
              >
                <Table stickyHeader size="small">
                  <colgroup><col style={{ width: 120 }} /><col style={{ width: 90 }} /><col style={{ width: 90 }} /><col style={{ width: 80 }} /><col style={{ width: 90 }} /><col style={{ width: 160 }} /></colgroup>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', minWidth: 100 }}>LotNo</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', minWidth: 60 }}>Carburizing Furnace</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', minWidth: 60 }}>Tempering Furnace</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', minWidth: 70 }}>SubSample No</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', minWidth: 80 }}>MeasValue</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', borderBottom: '1px solid', borderColor: 'divider', minWidth: 140 }}>MeasDate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      // 右侧table也用filteredTableData
                      const sortedTableData = [...filteredTableData].sort((a, b) => {
                        if (a.LotNo !== b.LotNo) {
                          return a.LotNo.localeCompare(b.LotNo);
                        }
                        return (a.SubSampleNo || 0) - (b.SubSampleNo || 0);
                      });
                      return sortedTableData.length > 0 ? (
                        sortedTableData.map((item, index) => (
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
                      );
                    })()}
                </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>) : (
          <Box sx={{ width: '100%', boxSizing: 'border-box' }}>
            <IndividualLotTableGeneralInfo row={row} Period={Period} pieFilter={pieFilter} subsampleData={filteredTableData} />
          </Box>)
        }
        {/* Furnace distribution pies (relocated here, to the right of the histogram) */}
        {displayPP && filteredTableData.length > 0 && (
          <Box sx={{ mt: 3, width: '100%', boxSizing: 'border-box' }}>
            <Typography variant="h6" gutterBottom>Furnace Distribution</Typography>
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
      </Grid>
    </Box>
  );
};

export default OverallLotsDistributionTable;