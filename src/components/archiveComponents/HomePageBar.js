import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography } from '@mui/material';
import { BarChart } from '@mui/x-charts/BarChart';

const HomePageBar = () => {
  const [chartData, setChartData] = useState({ labels: [], ppData: [] });

  useEffect(() => {
    console.log('Fetching data...');
    axios.get('http://localhost:3001/api/data')
      .then(response => {
        const filteredData = response.data;

        // Prepare data for the chart
        const labels = filteredData.map(row => row.MachineId);
        const ppData = filteredData.map(row => row.PP);
        console.log('Data fetched:', labels, ppData);
        setChartData({ labels, ppData });
      })
      .catch(error => {
        console.error('Error fetching data:', error);
      });
  }, []);

  return (
    <Box>
      <Typography variant="h6">HomePageBar</Typography>
      {chartData.labels.length > 0 && (
        <BarChart
          width={500}
          height={300}
          series={[
            { data: chartData.ppData, label: 'PP', id: 'ppId', stack: 'total' },
          ]}
          xAxis={[{ data: chartData.labels, scaleType: 'band' }]}
        />
      )}
    </Box>
  );
};

export default HomePageBar;