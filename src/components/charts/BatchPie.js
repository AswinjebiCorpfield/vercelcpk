import React, { useEffect, useState } from 'react';
import { Grid, TextField, Button, Typography, MenuItem } from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import axios from 'axios';

const BatchPie = () => {
    const [temperCount, setTemperCount] = useState([]);
    const [carbonizeInput, setCarbonizeInput] = useState('TVC2');
    const [summaryData, setSummaryData] = useState([]);
    const [percentages, setPercentages] = useState([]);
    const carbonizes = ['TVC1', 'TVC2', 'TVC3', 'TVC4', 'TVC5', 'TVC6'];

    useEffect(() => {
        axios.get('http://localhost:5000/db/getCPKTestData')
            .then(response => {
                const data = [];
                console.log('Fetching TAT & TVC data...');
                response.data.forEach(item => {
                    if (item.BatchMC3 === carbonizeInput) {
                        data.push({ Carbonize: item.BatchMC3, Temper: item.BatchMC4, id: item.index });
                    }
                });

                // Group by Temper and count the occurrences
                const temperCounts = data.reduce((acc, item) => {
                    acc[item.Temper] = (acc[item.Temper] || 0) + 1;
                    return acc;
                }, {});

                // Convert to array and sort by count
                const summary = Object.entries(temperCounts).map(([temper, count]) => ({ temper, count }));
                setSummaryData(summary);

                // Calculate percentages
                const total = summary.reduce((acc, item) => acc + item.count, 0);
                const percentages = summary.map(item => ({
                    temper: item.temper,
                    count: item.count,
                    percentage: ((item.count / total) * 100).toFixed(2)
                }));
                setPercentages(percentages);

                console.log('Temper counts:', summary);
                console.log('Percentages:', percentages);
            })
            .catch(error => console.error('Error fetching machine data:', error));
    }, [carbonizeInput]);

    return (
        <Grid container m={10} spacing={2} direction="column">
            <Grid item xs={12}>
                <Typography variant="h6">Select Carbonize to begin</Typography>
                <TextField
                    select
                    label="Carbonize"
                    value={carbonizeInput}
                    onChange={(e) => setCarbonizeInput(e.target.value)}
                    size="large"
                    margin="dense"
                    sx={{ width: 500, marginRight: 2 }}
                >
                    {carbonizes.map((option) => (
                        <MenuItem key={option} value={option}>
                            {option}
                        </MenuItem>
                    ))}
                </TextField>
            </Grid>
            <Grid item xs={12}>
                <Typography variant="h6">Temper Summary</Typography>
                {percentages.map((item, index) => (
                    <Typography key={index}>{`Temper: ${item.temper}, Count: ${item.count}, Percentage: ${item.percentage}%`}</Typography>
                ))}
            </Grid>
            <Grid item xs={12}>
                <PieChart
                sx={{ width: 1000 }}
                    series={[
                        {
                            data: percentages.map((item, index) => ({ id: index, value: item.percentage, 
                                label: `${item.temper}, Count: ${item.count}, Percentage: ${item.percentage}%` })),
                            arcLabel: (data) => `${data.value}%`,
                            arcLabelMinAngle: 30,
                        },
                    ]}
                    width={400}
                    height={200}
                />
            </Grid>
        </Grid>
    );
};

export default BatchPie;

// {dataList.length > 0 && (
//     <Grid item xs={12} sm={12} md={12}>
//         <Card sx={{ marginTop: 2, width: '100%' }}>
//             <Grid container direction="row" spacing={2}>
//                 <Grid item xs={6} sm={6} md={6}>
//                     <CardContent>
//                         <Typography variant="h3" sx={{ mb: 2 }}>CPK & PPK Summary</Typography>
//                         {/* 这里简单展示一些数据信息，可根据需求完善 */}
//                         <Typography variant="h5">CPK & PPK Percentage Summary</Typography>
//                     </CardContent>
//                 </Grid>
//                 <Grid item xs={6} sm={6} md={6}>
//                     <Box sx={{ marginBottom: 2 }}>
//                         <BarChart
//                             width={1000}
//                             height={250}
//                             sx={{
//                                 marginTop: 2,
//                             }}
//                             series={[
//                                 {
//                                     data: dataList.map((item) => ({
//                                         x: item.MeasDay,
//                                         y: item.CPK_AC_Percentage
//                                     })),
//                                     label: 'CPK_AC_Percentage',
//                                     id: 'cpkAcPercentageId',
//                                     color: '#40DFEF',
//                                 },
//                                 {
//                                     data: dataList.map((item) => ({
//                                         x: item.MeasDay,
//                                         y: item.PPK_AC_Percentage
//                                     })),
//                                     label: 'PPK_AC_Percentage',
//                                     id: 'ppkAcPercentageId',
//                                     color: '#e78ea9',
//                                 },
//                             ]}
//                             xAxis={[{ scaleType: 'band', data: dataList.map((item) => item.MeasDay) }]}
//                             yAxis={[{ scaleType: 'linear' }]}
//                             value="y"
//                             barLabel={({ value }) => `${value}%`}
//                         />
//                     </Box>
//                 </Grid>
//             </Grid>
//         </Card>
//     </Grid>
// )}