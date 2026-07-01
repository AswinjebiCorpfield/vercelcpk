import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography } from '@mui/material';
import { ScatterChart } from '@mui/x-charts/ScatterChart';

const MachineScatter = () => {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    axios.get('http://localhost:5000/db/getCPKTestData')
      .then(response => {
        const data = [];
        console.log('Fetching machine data...');
        // Process each machineId and its corresponding PP values
        response.data.forEach(item => {
          if (item.PPK !== null && !isNaN(item.PPK)) {
            const color = item.PPK < 1 ? 'red' : 'blue';
            data.push({ id: item.index, x: item.Mean, y: parseFloat(item.PPK), color });
            
            // const date = new Date(item.Date).getTime();
            // data.push({ id: item.index, x: item.date, y: parseFloat(item.PPK) });
          } else {
            console.warn(`Invalid PPK value for MachineId ${item.MachineId}:`, item.PPK);
          }
        });

        setChartData(data);
        console.log('Data fetched:', data);
      })
      .catch(error => console.error('Error fetching machine data:', error));
  }, []);

  return (
    <Box sx={{ ml: 50 }}>
      <Typography variant="h6">Machine Scatterplot</Typography>
      {chartData.length > 0 && (
          <ScatterChart
          width={500}
          height={300}
          series={[{ data: chartData, label: 'PPK vs MachineId', id: 'ppkId'}]}
          xAxis={[{ label: 'MachineId', type: 'category' }]}
          
          // xAxis={[{ label: 'Month', type: 'time', scaleType: 'time', tickFormat: '%b' }]}
          yAxis={[{ label: 'PPK' }]}
          />
          )}
      <Typography variant="caption">Data points: {chartData.length}</Typography>
      {/* <Box>
        {chartData.map((item, index) => (
          <Typography key={index} variant="caption">
            {`MachineId: ${item.x}, PPK: ${item.y}`}
          </Typography>
        ))}
      </Box> */}
    </Box>
  );
};
// const data = Array.from({ length: 200 }, () => ({
//   x: chance.floating({ min: -25, max: 25 }),
//   y: chance.floating({ min: -25, max: 25 }),
// })).map((d, index) => ({ ...d, id: index }));



export default MachineScatter;