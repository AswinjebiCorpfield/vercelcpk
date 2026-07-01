import React, { useEffect, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import axios from 'axios';
import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import { NoSim, X } from '@mui/icons-material';

const NCLotCountBar = () => {
    const [topMachineNCData, setTopMachineNCData] = useState([]);
    const [topPartNameNCData, setTopPartNameNCData] = useState([]);

    const machineIdList = topMachineNCData.map(item => item.machineId);
    const partNameList = topPartNameNCData.map(item => item.partName);
    const machineCountList = topMachineNCData.map(item => item.count);
    const partNameCountList = topPartNameNCData.map(item => item.count); // 但是这里可以简化，之后做

    useEffect(() => {
        axios.get('http://localhost:5000/db/getCPKTestData')
            .then(response => {
                const data = [];
                console.log('Fetching machine & Part Name NC data...');
                response.data.forEach(item => {
                    if (item.PPK !== null && !isNaN(item.PPK) && item.PPK < 1) {
                        data.push({ MachineId: item.MachineId, PartName: item.Part_Name, id: item.index, PPK: parseFloat(item.PPK) });
                    } else {
                        // console.warn(`Invalid PPK value for MachineId ${item.MachineId}:`, item.PPK);
                    }
                });

                // Group by MachineId and count the occurrences of NC
                const machineNCCounts = data.reduce((acc, item) => {
                    acc[item.MachineId] = (acc[item.MachineId] || 0) + 1;
                    return acc;
                }, {});

                // Convert to array and sort by count
                const sortedMachineNCCounts = Object.entries(machineNCCounts)
                    .map(([machineId, count]) => ({ machineId, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10); // Get top 10

                setTopMachineNCData(sortedMachineNCCounts);
                console.log('Top 10 Machine NC Data:', sortedMachineNCCounts);

                // Group by PartName and count the occurrences of NC
                const partNameNCCounts = data.reduce((acc, item) => {
                    acc[item.PartName] = (acc[item.PartName] || 0) + 1;
                    return acc;
                }, {});

                // Convert to array and sort by count
                const sortedPartNameNCCounts = Object.entries(partNameNCCounts)
                    .map(([partName, count]) => ({ partName, count }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 10); // Get top 10

                setTopPartNameNCData(sortedPartNameNCCounts);
                console.log('Top 10 Part Name NC Data:', sortedPartNameNCCounts);
            })
            .catch(error => console.error('Error fetching machine data:', error));
    }, []);

    return (
        <Grid container m={10} spacing={2} direction="column" sx={{ml: 50}}>
            <Grid item xs={12}>
            <Typography variant="h4" color='#00b0ff'> Machine NC Count</Typography>
            <Grid container spacing={2} direction="row">
            <Grid item>
                
            <Typography variant="h6" color=''>Top 10 Machines NC count</Typography>
            <BarChart
                    width={800}
                    height={300}
                    series={[
                        {
                          data: machineCountList,
                          label: 'Machine ID',
                          id: 'ncId',
                          stack: 'total'
                        }
                      ]}
                    xAxis={[{ data: machineIdList, scaleType: 'band', label: 'Machine ID' }]}
                    yAxis={[{ label: 'NC Count' }]}
                />
            </Grid>
            <Grid item>
            <Typography variant="h6">Top 3 Machines with Most NC</Typography>
            {topMachineNCData.map((item, index) => (
                <Grid item xs={12} key={index[0]}>
                    <Card sx={{ width: '100%' }}>
                    <CardContent sx={{display:"flex"}}>
                            <Typography variant="h7">{`Machine ID: ${item.machineId}`}</Typography>
                            <Typography variant="h7">{`NC Count: ${item.count}`}</Typography>
                            <Typography variant="h7">{`AC Count: ${item.count}`}</Typography>
                            <Typography variant="h7">{`NC Percentage (%): ${item.count}`}</Typography>
                        </CardContent>
                    </Card>
                </Grid>
            ))}
            </Grid>
            </Grid>
            <Grid item xs={12}>
            <Typography variant="h4" color='#00b0ff'> Part Name NC Count</Typography>
                    <Grid container spacing={2} direction="row">
                        <Grid item>
                            
                    <Typography variant="h6">Top 10 Part Names with Most NC</Typography>
                    <BarChart
                    width={800}
                    height={300}
                    series={[
                        {
                          data: partNameCountList,
                          label: 'Part Name',
                          id: 'ncId',
                          stack: 'total'
                        }
                      ]}
                    xAxis={[{ data: partNameList, scaleType: 'band', label: 'Part Name' }]}
                    yAxis={[{ label: 'NC Count' }]}
                />
                        </Grid>
                        <Grid item>
                            
            <Typography variant="h6">Top 3 Part Name NC Count</Typography>
                        {topPartNameNCData.map((item, index) => (
                            <Grid item xs={12} key={index}>
                                <Card sx={{ width: '100%' }}>
                                    <CardContent sx={{display:"flex"}}>
                                        <Typography variant="h7">{`Part Name: ${item.partName}`}</Typography>
                                        <Typography variant="h7">{`NC Count: ${item.count}`}</Typography>
                                        <Typography variant="h7">{`AC Count: ${item.count}`}</Typography>
                                        <Typography variant="h7">{`NC Percentage (%): ${item.count}`}</Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                        </Grid>
                    </Grid>
            </Grid>
        </Grid>
        </Grid>
    );
};

export default NCLotCountBar;