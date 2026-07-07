import React, { useState, useEffect, useMemo } from 'react';
import NavBar from './components/NavBar';
import Login from './components/user/Login';
import Notification from './components/Notification';
import { ThemeProvider } from '@mui/material/styles';
import { createPcmTheme } from './theme/pcmTheme';
import { ColorModeProvider, useColorMode } from './context/ColorModeContext';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Stack from '@mui/material/Stack';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import dayjs from 'dayjs';
import ConstructionIcon from '@mui/icons-material/Construction'; // 引入图标增加视觉效果
import HistoricalOverallLots from './components/tables/HistoricalOverallLots';
import NCLotRankBar from './components/charts/NCLotRankBar';
import LotsCPPKBarChart from './components/charts/LotsCPPKBarChart';
import LotCPKBarChart from './components/charts/LotCPKBarChart';
import OverallLotsClickedTable from './components/tables/OverallLotsClickedTable';
import OverallLotsDistributionTable from './components/tables/OverallLotsDistributionTable';
import SubsampleScatterDistribution from './components/charts/SubsampleScatterDistribution';
import IndividualLotClickedTable from './components/tables/IndividualLotsClickedTable';
import AuthLayout from './app/auth/layout';
import NCSubsampleScatterBarChart from './components/charts/NCSubsampleScatterBarChart';
import DataPurgeConfig from './components/DataPurgeConfig';
import { TimeSeriesContext } from './context/TimeSeriesContext';

const queryClient = new QueryClient();

// ----------------------------------------------------------------------
// Hierarchical routing
// ----------------------------------------------------------------------
// Every page is identified by the LAST segment of the URL path, so the same
// page can live at any depth. Drill-in navigation appends child segments
// (see utils/useDrilldownNavigate), producing self-describing URLs such as
//   /lot-cpk-bar/individual-lot-clicked-table/lots-sample-distribution-table
// without having to enumerate every parent/child combination as a route.
const PAGE_BY_SEGMENT = {
  '': LotCPKBarChart,                 // "/" landing (Individual Lot CPK)
  'login': Login,
  'lot-cpk-bar': LotCPKBarChart,
  'individual-lot-clicked-table': IndividualLotClickedTable,
  'lots-cpk-ppk-bar': LotsCPPKBarChart,
  'overall-lots-clicked-table': OverallLotsClickedTable,
  'lots-sample-distribution-table': OverallLotsDistributionTable,
  'subsample-scatter': SubsampleScatterDistribution,
  'lots-historical-summary': HistoricalOverallLots,
  'nc-lot-bar': NCLotRankBar,
  'nc-scatter-bar-chart': NCSubsampleScatterBarChart,
  'data-purge-config': DataPurgeConfig,
};

const PageBySegment = () => {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || '';
  const Page = PAGE_BY_SEGMENT[last] || LotCPKBarChart;
  // Key on the full path so each distinct URL mounts a fresh instance
  // (matches the previous one-Route-per-URL behaviour and re-runs data fetches).
  return <Page key={pathname} />;
};

// (theme moved to ./theme/pcmTheme.js — createPcmTheme(mode))

// ----------------------------------------------------------------------
// 维护页面组件
// ----------------------------------------------------------------------
const MaintenancePage = () => (
  <Box
    sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#121212',
      color: 'white',
      textAlign: 'center',
      p: 3
    }}
  >
    <ConstructionIcon sx={{ fontSize: 80, mb: 2, color: '#ffa726' }} />
    <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2, fontFamily: 'Biome, Arial' }}>
      System Maintenance
    </Typography>
    <Typography variant="h5" sx={{ opacity: 0.8, mb: 4 }}>
      Maintenance in progress, will be ready by <b>2026 Mar Wk 3</b>
    </Typography>
    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
      @2025 Process Capability Metrics Dashboard | Developed By SPL-PID [ SPC ] Department
    </Typography>
  </Box>
);

const AppInner = () => {
  const { mode } = useColorMode();
  const theme = useMemo(() => createPcmTheme(mode), [mode]);
  // 🚀 维护开关：改为 true 即可全站封锁，改为 false 恢复正常
  const isMaintenance = false;

  const [updateTime, setUpdateTime] = useState(new Date().toLocaleTimeString());
  // Time Series 全局控制 - 默认 false 以显示原始稀疏数据，避免 gap filling 导致数据丢失
  const [isTimeSeries, setIsTimeSeries] = useState(true);

  useEffect(() => {
    if (isMaintenance) return; // 维护期间不请求数据
    const fetchData = async () => {
      try {
        const response = await axios.get(`${window.baseURL}/update-time`);
        const latestUpdateTime = response.data[0].latest_update_time;
        setUpdateTime(dayjs(latestUpdateTime).format('MMM D, YYYY HH:mm:ss'));
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    fetchData();
  }, [isMaintenance]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isMaintenance ? (
        <MaintenancePage />
      ) : (
        <QueryClientProvider client={queryClient}>
          <TimeSeriesContext.Provider value={{ isTimeSeries, setIsTimeSeries }}>
            <Router basename={process.env.REACT_APP_BASE_PATH || ''}>
              <AuthLayout>
                <Notification />
                <Login />
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                <NavBar />
                <Box
                  className="pcm-fade"
                  sx={{
                    maxWidth: '100%',
                    mx: 'auto',
                    px: 2,
                    width: '100%',
                    flex: '1 0 auto',
                    boxSizing: 'border-box',
                    overflowX: 'auto',
                    '& > *': { width: '100%', maxWidth: '100%' },
                  }}
                >
                  <Routes>
                    {/* Single resolver: the page is chosen by the last URL segment,
                        so drill-in pages can live at any depth (hierarchical URLs). */}
                    <Route path="*" element={<PageBySegment />} />
                  </Routes>
                </Box>
              {/* Footer — in document flow (no longer fixed, so it never overlaps content) */}
              <Box
                component="footer"
                sx={{
                  mt: 1.5,
                  px: 2.5,
                  py: 1,
                  display: 'flex',
                  flexDirection: { xs: 'column', sm: 'row' },
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 0.5,
                  borderTop: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'background.paper',
                  color: 'text.secondary',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Data Refresh Time: {updateTime}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.85 }}>
                  © 2025 Process Capability Metrics Dashboard · Developed by SPL-PID [ SPC ] Department
                </Typography>
              </Box>
              </Box>
              </AuthLayout>
            </Router>
          </TimeSeriesContext.Provider>
        </QueryClientProvider>
      )}
    </ThemeProvider>
  );
};

const App = () => (
  <ColorModeProvider>
    <AppInner />
  </ColorModeProvider>
);

export default App;
