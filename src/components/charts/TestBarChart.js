import * as React from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import { Box, Stack, Typography, Switch, FormControlLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, CircularProgress } from '@mui/material';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import axios from 'axios';
import { useEffect, useState } from 'react';

const LotsCPPKBarChart = () => {
    const [datasets, setDatasets] = useState([]); // 存储处理后的数据
    const [timeRange, setTimeRange] = useState('Daily');
    const [displayMode, setDisplayMode] = useState('Count');
    const [selectedData, setSelectedData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios.get(`http://localhost:5259/overall-lots-cpk-ppk-summary-ac-nc?timeRange=${timeRange}&displayMode=${displayMode}`)
            .then(response => {
                console.log('Fetching overall lots CPK & PPK data...');
                const dataList = response.data;

                // 数据处理逻辑
                const cpkDatasets = {
                    acData: [],
                    ncData: [],
                    xLabels: []
                };
                const ppkDatasets = {
                    acData: [],
                    ncData: [],
                    xLabels: []
                };

                let totalAC_CPK = 0;
                let totalNC_CPK = 0;
                let totalAC_PPK = 0;
                let totalNC_PPK = 0;

                dataList.forEach(item => {
                    const date = `${item.MeasYear}-${item.MeasMon.toString().padStart(2, '0')}-${(item.MeasDay || 1).toString().padStart(2, '0')}`;
                    const cpkACCount = item.CPK_AC_Count || 0;
                    const cpkNCCount = item.CPK_NC_Count || 0;
                    const ppkACCount = item.PPK_AC_Count || 0;
                    const ppkNCCount = item.PPK_NC_Count || 0;

                    const cpkACPercentage = displayMode === 'Percentage' ? item.CPK_AC_Percentage || 0 : cpkACCount;
                    const cpkNCPercentage = displayMode === 'Percentage' ? item.CPK_NC_Percentage || 0 : cpkNCCount;
                    const ppkACPercentage = displayMode === 'Percentage' ? item.PPK_AC_Percentage || 0 : ppkACCount;
                    const ppkNCPercentage = displayMode === 'Percentage' ? item.PPK_NC_Percentage || 0 : ppkNCCount;

                    cpkDatasets.acData.push(cpkACPercentage);
                    cpkDatasets.ncData.push(cpkNCPercentage);
                    ppkDatasets.acData.push(ppkACPercentage);
                    ppkDatasets.ncData.push(ppkNCPercentage);

                    cpkDatasets.xLabels.push(date);
                    ppkDatasets.xLabels.push(date);

                    totalAC_CPK += cpkACCount;
                    totalNC_CPK += cpkNCCount;
                    totalAC_PPK += ppkACCount;
                    totalNC_PPK += ppkNCCount;
                });

                if (displayMode === 'Percentage') {
                    const cpkTotal = cpkDatasets.acData.reduce((sum, val) => sum + val, 0) + cpkDatasets.ncData.reduce((sum, val) => sum + val, 0);
                    const ppkTotal = ppkDatasets.acData.reduce((sum, val) => sum + val, 0) + ppkDatasets.ncData.reduce((sum, val) => sum + val, 0);

                    cpkDatasets.acData = cpkDatasets.acData.map(val => (val / cpkTotal) * 100);
                    cpkDatasets.ncData = cpkDatasets.ncData.map(val => (val / cpkTotal) * 100);
                    ppkDatasets.acData = ppkDatasets.acData.map(val => (val / ppkTotal) * 100);
                    ppkDatasets.ncData = ppkDatasets.ncData.map(val => (val / ppkTotal) * 100);
                }

                const averagePercentageCPK = totalAC_CPK + totalNC_CPK !== 0 ? (totalAC_CPK / (totalAC_CPK + totalNC_CPK) * 100) : 0;
                const averagePercentagePPK = totalAC_PPK + totalNC_PPK !== 0 ? (totalAC_PPK / (totalAC_PPK + totalNC_PPK) * 100) : 0;

                const processedData = [
                    {
                        acData: cpkDatasets.acData,
                        ncData: cpkDatasets.ncData,
                        xLabels: cpkDatasets.xLabels,
                        title: 'Overall Lots CPK',
                        averagePercentage: averagePercentageCPK,
                        totalAC: totalAC_CPK,
                        totalNC: totalNC_CPK
                    },
                    {
                        acData: ppkDatasets.acData,
                        ncData: ppkDatasets.ncData,
                        xLabels: ppkDatasets.xLabels,
                        title: 'Overall Lots PPK',
                        averagePercentage: averagePercentagePPK,
                        totalAC: totalAC_PPK,
                        totalNC: totalNC_PPK
                    }
                ];

                setDatasets(processedData); // 更新 datasets
                setLoading(false);
            })
            .catch(error => {
                console.error('Error fetching machine data:', error);
                setLoading(false);
            });
    }, [timeRange, displayMode]);

    const handleTimeRangeChange = (event) => {
        setTimeRange(event.target.checked ? 'Monthly' : 'Daily');
    };

    const handleDisplayModeChange = (event) => {
        setDisplayMode(event.target.checked ? 'Percentage' : 'Count');
    };

    const handleBarClick = (params) => {
        const { dataIndex, seriesIndex } = params;
        const dataset = datasets[seriesIndex];
        if (!dataset) {
            console.error('Dataset is undefined for seriesIndex:', seriesIndex);
            return;
        }
        const date = dataset.xLabels[dataIndex];
        const acData = dataset.acData[dataIndex];
        const ncData = dataset.ncData[dataIndex];
        setSelectedData({ date, acData, ncData });
    };

    return (
        <Grid container spacing={2} direction="column" sx={{ height: '100vh', width: '100vw' }}>
            <Grid item xs={12}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography>Daily</Typography>
                    <FormControlLabel
                        control={<Switch checked={timeRange === 'Monthly'} onChange={handleTimeRangeChange} />}
                    />
                    <Typography>Monthly</Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography>Count</Typography>
                    <FormControlLabel
                        control={<Switch checked={displayMode === 'Percentage'} onChange={handleDisplayModeChange} />}
                    />
                    <Typography>Percentage</Typography>
                </Stack>
            </Grid>
            {loading ? (
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <CircularProgress />
                </Grid>
            ) : (
                datasets.map((dataset, index) => (
                    <Grid item xs={12} key={index} sx={{ flexGrow: 1 }}>
                        <Card sx={{ marginTop: 2, height: '100%' }}>
                            <Grid container direction="row" spacing={2} sx={{ height: '100%' }}>
                                <Grid item xs={4}>
                                    <CardContent>
                                        <Typography variant="h3" sx={{ mb: 2 }}>{dataset.title}</Typography>
                                        <Typography variant="h5">{`AC Percentage:`}</Typography>
                                        <Typography variant="h4" component="span">{`${dataset.averagePercentage.toFixed(2)} %`}</Typography>
                                        {
                                            displayMode === "Count" ? (
                                                <>
                                                <Typography variant="h5">AC Count:</Typography>
                                                <Typography variant="h4" component="span" color="#ff5722" sx={{ color:'red!important'}}>{dataset.totalAC}</Typography>
                                                <Typography variant="h5" component="span">{" Lots"}</Typography>
                                                <Typography variant="h5">NC Count:</Typography>
                                                <Typography variant="h4" component="span" color='#e78ea9'>{dataset.totalNC}</Typography>
                                                <Typography variant="h5" component="span">{" Lots"}</Typography>
                                                </>
                                            ) : (
                                                <></>
                                            )
                                        }
                                    </CardContent>
                                </Grid>
                                <Grid item xs={8}>
                                    <Box sx={{ height: '100%' }}>
                                    <BarChart
                                        width="100%"
                                        height={500}
                                        sx={{
                                            marginTop: 2,
                                        }}
                                        series={[
                                            {
                                                data: dataset.acData,
                                                label: displayMode === 'Percentage' ? 'AC(%)' : 'AC Lot Number',
                                                id: `pvId-${index}`,
                                                stack: 'total',
                                                color: 'blue',
                                            },
                                            {
                                                data: dataset.ncData,
                                                label: displayMode === 'Percentage' ? 'NC(%)' : 'NC Lot Number',
                                                id: `uvId-${index}`,
                                                stack: 'total',
                                                color: 'red',
                                            },
                                        ]}
                                        xAxis={[{ data: dataset.xLabels, scaleType: 'band' }]}
                                        barLabel={({ value }) => `${value}`}
                                        // onClick={handleBarClick}
                                        onItemClick={handleBarClick}
                                    />
                                    </Box>
                                </Grid>
                            </Grid>
                        </Card>
                    </Grid>
                ))
            )}
            {selectedData && (
                <Grid item xs={12}>
                    <TableContainer component={Paper}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>AC Data</TableCell>
                                    <TableCell>NC Data</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                <TableRow>
                                    <TableCell>{selectedData.date}</TableCell>
                                    <TableCell>{selectedData.acData}</TableCell>
                                    <TableCell>{selectedData.ncData}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Grid>
            )}
        </Grid>
    );
}

export default LotsCPPKBarChart;