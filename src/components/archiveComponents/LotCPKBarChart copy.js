import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
} from '@mui/material';
import axios from 'axios';
import { useEffect, useState } from 'react';

const LotCPKBarChart = () => {
  const [dailyData, setDailyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [displayMode, setDisplayMode] = useState('Count');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const dailyResp = await axios.post('http://localhost:5259/unified-data', {
          dataType: 'ACNCdata_daily',
          filter: {},
        });
        setDailyData(dailyResp.data || []);

        const monthlyResp = await axios.post('http://localhost:5259/unified-data', {
          dataType: 'ACNCdata_monthly',
          filter: {},
        });
        setMonthlyData(monthlyResp.data || []);
      } catch (error) {
        console.error('Error fetching ACNC data:', error);
        setDailyData([]);
        setMonthlyData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [displayMode]);

const processData = (data, displayMode) => {
  const acData = [];
  const ncData = [];
  const xLabels = [];
  let totalAC = 0;
  let totalNC = 0;

  data.forEach(item => {
    let dateStr = item.MeasDate;
    if (dateStr && dateStr.includes('T')) {
      dateStr = dateStr.split('T')[0];
    }
    xLabels.push(dateStr);

    if (displayMode === 'Percentage') {
      acData.push(item.CPK_GT_1_Percent ?? 0);
      ncData.push(item.CPK_LT_1_Percent ?? 0);
      totalAC += item.CPK_GT_1_Percent ?? 0;
      totalNC += item.CPK_LT_1_Percent ?? 0;
    } else {
      acData.push(item.CPK_GT_1_Count ?? 0);
      ncData.push(item.CPK_LT_1_Count ?? 0);
      totalAC += item.CPK_GT_1_Count ?? 0;
      totalNC += item.CPK_LT_1_Count ?? 0;
    }
  });

  return {
    acData,
    ncData,
    xLabels,
    totalAC,
    totalNC,
    averagePercentage: (totalAC / ((totalAC + totalNC) || 1)) * 100,
  };
};

  const dailyDatasets = processData(dailyData, displayMode);
  const monthlyDatasets = processData(monthlyData, displayMode);

  const handleDisplayModeChange = (_, newMode) => {
    if (newMode !== null) setDisplayMode(newMode);
  };

  if (loading) {
    return (
      <Grid container justifyContent="center" alignItems="center" sx={{ height: '80vh' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>
          Loading...
        </Typography>
      </Grid>
    );
  }

  return (
    <Grid container spacing={2} direction="column" sx={{ ml: 4, mr: 4 }}>
      <Grid item xs={12}>
        <Typography variant="h3" sx={{ mb: 2, mt: 2 }}>
          Individual Lot CPK Overview
        </Typography>
      </Grid>

      {/* Display Mode Toggle */}
      <Grid item xs={12}>
        <ToggleButtonGroup
          value={displayMode}
          exclusive
          onChange={handleDisplayModeChange}
          aria-label="Display Mode"
          sx={{ mb: 2 }}
        >
          <ToggleButton value="Count" aria-label="Count">
            Count
          </ToggleButton>
          <ToggleButton value="Percentage" aria-label="Percentage">
            Percentage
          </ToggleButton>
        </ToggleButtonGroup>
      </Grid>

      {/* Daily Chart */}
      <Grid item xs={12}>
        <Card sx={{ marginTop: 2, width: '100%' }}>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Daily Individual Lot CPK
            </Typography>
            <Typography variant="h6">AC Percentage:</Typography>
            <Typography variant="h4" component="span" color="primary">
              {`${dailyDatasets.averagePercentage.toFixed(2)} %`}
            </Typography>
            <Box sx={{ marginTop: 2, width: '100%', overflowX: 'auto' }}>
              <BarChart
                width={dailyDatasets.xLabels.length * 40} 
                height={300}
                series={[
                  {
                    data: dailyDatasets.acData,
                    label: displayMode === 'Percentage' ? 'AC(%)' : 'AC Lot Number',
                    id: 'acData',
                    stack: 'total',
                    color: 'blue',
                  },
                  {
                    data: dailyDatasets.ncData,
                    label: displayMode === 'Percentage' ? 'NC(%)' : 'NC Lot Number',
                    id: 'ncData',
                    stack: 'total',
                    color: 'red',
                  },
                ]}
                xAxis={[{ data: dailyDatasets.xLabels, scaleType: 'band' }]}
                value="value"
                barLabel={({ value }) => `${value}`}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>

      {/* Monthly Chart */}
      <Grid item xs={12}>
        <Card sx={{ marginTop: 2, width: '100%' }}>
          <CardContent>
            <Typography variant="h4" sx={{ mb: 2 }}>
              Monthly Individual Lot CPK
            </Typography>
            <Typography variant="h6">AC Percentage:</Typography>
            <Typography variant="h4" component="span" color="primary">
              {`${monthlyDatasets.averagePercentage.toFixed(2)} %`}
            </Typography>
            <Box sx={{ marginTop: 2 }}>
              <BarChart
                width={2000}
                height={300}
                series={[
                  {
                    data: monthlyDatasets.acData,
                    label: displayMode === 'Percentage' ? 'AC(%)' : 'AC Lot Number',
                    id: 'acData',
                    stack: 'total',
                    color: 'blue',
                  },
                  {
                    data: monthlyDatasets.ncData,
                    label: displayMode === 'Percentage' ? 'NC(%)' : 'NC Lot Number',
                    id: 'ncData',
                    stack: 'total',
                    color: 'red',
                  },
                ]}
                xAxis={[{ data: monthlyDatasets.xLabels, scaleType: 'band' }]}
                value="value"
                barLabel={({ value }) => `${value}`}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default LotCPKBarChart;