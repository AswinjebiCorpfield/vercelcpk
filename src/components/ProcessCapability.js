import React, { useState } from 'react';
import SideBar from './charts/SideBar';
import TestBarChart from './charts/TestBarChart';
import { Box, Grid } from '@mui/material';
import { Link } from'react-router-dom';
import MachineScatter from './charts/MachineScatter';
import NCLotCountBar from './archiveComponents/NCLotCountBar';
import BatchPie from './charts/BatchPie';
import { Button } from '@mui/material';
import LotsCPPKBarChart from './charts/LotsCPPKBarChart';
// Grid2 will mess the layout

const ProcessCapability = () => {
  const [figureDisplay, setFigureDisplay] = useState('Percentage%');
  const [dateTypeDisplay, setDateTypeDisplay] = useState('Monthly');

  const handleFigureDisplayChange = (event, newFigureDisplay) => {
    if (newFigureDisplay !== null) {
      setFigureDisplay(newFigureDisplay);
    }
  };

  const handleDateTypeDisplayChange = (event, newDateTypeDisplay) => {
    if (newDateTypeDisplay !== null) {
      setDateTypeDisplay(newDateTypeDisplay);
    }
  };

  return ( //这里的layout之后改把
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', marginTop: '64px' }}>
      <Grid container spacing={5} sx={{ flexGrow: 1, display: 'flex' }}>
        <Grid item xs={12} sm={1.6}>
          {/* <SideBar
            figureDisplay={figureDisplay}
            handleFigureDisplayChange={handleFigureDisplayChange}
            dateTypeDisplay={dateTypeDisplay}
            handleDateTypeDisplayChange={handleDateTypeDisplayChange}
          /> */}
        </Grid>
        <Grid item xs={12} sm={9}>
          <Box component="main" sx={{ p: 3, overflow: 'auto',display: 'flex', flexDirection: 'column' }}>
            {/* <NCLotCountBar /> */}
            <LotsCPPKBarChart />
            {/* <TestBarChart figureDisplay={figureDisplay} dateTypeDisplay={dateTypeDisplay} marginLeft={350}/> */}
            {/* <MachineScatter/>
            <BatchPie /> */}
          </Box>
          <div>
          {/* <Link to="/lots-sample-scatter" underline="hover">
              <Button variant="contained" color="primary">
                Machine Scatter
              </Button>
          </Link>
      <Link to="/lots-sample-scatter">Machine Scatter</Link>
      <Link to="/nc-lot-bar">NC Count</Link> */}
    </div>

        </Grid>
      </Grid>
    </Box>
  );
};

export default ProcessCapability;