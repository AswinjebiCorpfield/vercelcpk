import React, { useEffect, useState } from 'react';
import { BarChart } from '@mui/x-charts/BarChart';
import axios from 'axios';
import { Box, Card, CardContent, CircularProgress, Grid, Typography, TextField, Button, MenuItem } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import './NCLotRankBar.css';
import { useValue } from '../../context/ContextProvider';

  function formatMonthYear(monthStr) {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const date = new Date(`${year}-${month}-01`);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`;
  }

const NCLotRankBar = () => {
    const [machineNCData, setMachineNCData] = useState([]);
    const [materialNCData, setMaterialNCData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [availableOptions, setAvailableOptions] = useState({});
    const [allMonths, setAllMonths] = useState({ StartMonth: [], EndMonth: [] });
    const { state, dispatch } = useValue();

    // 直接用 context 的 filters，去掉本地 filters 状态
    const filters = state.filters || {
        Dept: 'HT',
        MachineId: '',
        MaterialDesc: '',
        DimensionDesc: '',
        CAT: '',
        StartMonth: '',
        EndMonth: '',
    };

    // 处理筛选变化
    const handleFilterChange = (key, value) => {
        const updated = { ...filters, [key]: value };
        dispatch({ type: 'UPDATE_FILTERS', payload: updated });
    };

    const handleClearFilters = () => {
        const cleared = {
            Dept: '',
            MachineId: '',
            MaterialDesc: '',
            DimensionDesc: '',
            CAT: '',
            StartMonth: '',
            EndMonth: '',
        };
        dispatch({ type: 'UPDATE_FILTERS', payload: cleared });
    };

    // 获取筛选选项
    useEffect(() => {
        const fetchFilterOptions = async () => {
            try {
                const response = await axios.post(
                    `${window.baseURL}/filter-options`,
                    { filter: filters },
                    { headers: { 'Content-Type': 'application/json' } }
                );
                setAvailableOptions(response.data);
            } catch (error) {
                console.error('Error fetching filter options:', error);
            }
        };
        fetchFilterOptions();
    }, [filters]);

    // 首次加载时拉取所有月份
useEffect(() => {
    const fetchAllMonths = async () => {
        try {
            const resp = await axios.post(
                `${window.baseURL}/filter-options`,
                { filter: {} },
                { headers: { 'Content-Type': 'application/json' } }
            );
            setAllMonths({
                StartMonth: resp.data.StartMonth || [],
                EndMonth: resp.data.EndMonth || [],
            });
        } catch (e) {
            setAllMonths({ StartMonth: [], EndMonth: [] });
        }
    };
    fetchAllMonths();
}, []);

    // 获取图表数据
    useEffect(() => {
        setLoading(true);
        const fetchData = async () => {
            try {
                const response = await axios.get(`${window.baseURL}/overall-lots-nc-rank`, {
                    params: {
                        datatype: 'MachineId',
                        dept: filters.Dept,
                        machineId: filters.MachineId,
                        MaterialDesc: filters.MaterialDesc,
                        dimensionDesc: filters.DimensionDesc,
                        cat: filters.CAT,
                        startMonth: filters.StartMonth,
                        endMonth: filters.EndMonth,
                    }
                });
                setMachineNCData(response.data);

                const materialResponse = await axios.get(`${window.baseURL}/overall-lots-nc-rank`, {
                    params: {
                        datatype: 'MaterialDesc',
                        dept: filters.Dept,
                        machineId: filters.MachineId,
                        MaterialDesc: filters.MaterialDesc,
                        dimensionDesc: filters.DimensionDesc,
                        cat: filters.CAT,
                        startMonth: filters.StartMonth,
                        endMonth: filters.EndMonth,
                    }
                });
                setMaterialNCData(materialResponse.data);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters]);

    const machinePpkLessThanOneCountList = machineNCData.map(item => item.PPK_Less_Than_One_Count);
    const machineIdList = machineNCData.map(item => item.MachineId);
    const materialPpkLessThanOneCountList = materialNCData.map(item => item.PPK_Less_Than_One_Count);
    const materialIdList = materialNCData.map(item => item.MaterialDesc);

    return (
        <Grid container spacing={1} sx={{ ml: 5, mt: 3, minWidth: 600, width: '100%', maxWidth: '100vw', overflow: 'hidden', flexWrap: 'wrap' }}>
            <Grid item xs={12} md={2} sx={{ minWidth: 260, maxWidth: 400, width: '100%', overflow: 'auto' }}>
                <Box
                    className="filter-area"
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: 3,
                        minWidth: 220,
                        maxWidth: 400,
                        width: '100%',
                        mt: 2,
                        overflow: 'auto',
                    }}
                >
                    {Object.keys(availableOptions)
                        .filter(key => key !== 'StartMonth' && key !== 'EndMonth')
                        .map((key) => (
                            <Autocomplete
                                key={key}
                                options={[
                                    '',
                                    ...((availableOptions[key] || []).filter(
                                        v => typeof v === 'string' && v.trim() !== '' && v !== null && v !== undefined
                                    ))
                                ]}
                                value={filters[key] ?? ''}
                                onChange={(e, value) => handleFilterChange(key, value)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label={key === 'MaterialDesc' ? 'MaterialDesc' : key}
                                        variant="outlined"
                                        sx={{ minWidth: 300 }}
                                        placeholder="All"
                                    />
                                )}
                                getOptionLabel={(option) => option === '' ? '' : option}
                                isOptionEqualToValue={(option, value) => option === value}
                                disableClearable={false}
                                ListboxProps={{ style: { maxHeight: 300 } }}
                                renderOption={(props, option) => (
                                    <li {...props}>{option === '' ? 'All' : option}</li>
                                )}
                                renderTags={() => null}
                            />
                        ))}
<TextField
    select
    label="Start Month"
    value={filters.StartMonth || ''}
    onChange={e => handleFilterChange('StartMonth', e.target.value)}
    variant="outlined"
    sx={{ minWidth: 300 }}
>
    <MenuItem value="">All</MenuItem>
    {(allMonths.StartMonth || []).map(month => {
        // 支持202409/2024-09/2024-09-01等格式
        let label = month;
        if (/^\d{6}$/.test(month)) {
            // 202409
            const year = month.slice(0, 4);
            const m = month.slice(4, 6);
            label = `${new Date(`${year}-${m}-01`).toLocaleString('en-US', { month: 'short' })} ${year}`;
        } else if (/^\d{4}-\d{2}$/.test(month)) {
            // 2024-09
            const [year, m] = month.split('-');
            label = `${new Date(`${year}-${m}-01`).toLocaleString('en-US', { month: 'short' })} ${year}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(month)) {
            // 2024-09-01
            const date = new Date(month);
            label = `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
        }
        return (
            <MenuItem key={month} value={month}>{label}</MenuItem>
        );
    })}
</TextField>
<TextField
    select
    label="End Month"
    value={filters.EndMonth || ''}
    onChange={e => handleFilterChange('EndMonth', e.target.value)}
    variant="outlined"
    sx={{ minWidth: 300 }}
>
    <MenuItem value="">All</MenuItem>
    {(allMonths.EndMonth || []).map(month => {
        let label = month;
        if (/^\d{6}$/.test(month)) {
            const year = month.slice(0, 4);
            const m = month.slice(4, 6);
            label = `${new Date(`${year}-${m}-01`).toLocaleString('en-US', { month: 'short' })} ${year}`;
        } else if (/^\d{4}-\d{2}$/.test(month)) {
            const [year, m] = month.split('-');
            label = `${new Date(`${year}-${m}-01`).toLocaleString('en-US', { month: 'short' })} ${year}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(month)) {
            const date = new Date(month);
            label = `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
        }
        return (
            <MenuItem key={month} value={month}>{label}</MenuItem>
        );
    })}
</TextField>
                    <Button variant="outlined" color="secondary" onClick={handleClearFilters}>
                        Clear Filters
                    </Button>
                </Box>
            </Grid>
            {/* 右侧 BarChart 区域 */}
            <Grid item xs={12} md={10} sx={{ minWidth: 400, width: '100%', overflow: 'auto', maxWidth: 'calc(100vw - 400px)' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <Typography variant="h4" color="#00b0ff">
                            PPK LESS THAN 1 RANK
                        </Typography>
                        <Grid container spacing={2} direction="row" sx={{ flexWrap: 'wrap' }}>
                            <Grid item xs={12} lg={8} sx={{ minWidth: 400, overflow: 'auto' }}>
                                <Typography variant="h6">Top 10 Machines PPK Less Than 1 Count</Typography>
                                <div className="custom-y-padding-bottom">
                                    <BarChart
                                        width={1200}
                                        height={500}
                                        xAxis={[
                                            {
                                                data: machineIdList.map(item => {
                                                    if (!item) return '';
                                                    const dashIdx = item.indexOf('-');
                                                    if (dashIdx !== -1) {
                                                        // 只让before换行，"-after"不换行
                                                        const before = item.slice(0, dashIdx).trim();
                                                        const after = item.slice(dashIdx).trim(); // 包含-本身
                                                        return `${before}\n${after}`;
                                                    } else {
                                                        // 没有-，用空格换行
                                                        return item.split(' ').join('\n');
                                                    }
                                                }),
                                                scaleType: 'band',
                                                label: 'Machine ID',
                                                height: 400,
                                                labelStyle: { marginTop: 40 },
                                            },
                                        ]}
    series={[
        {
            data: machinePpkLessThanOneCountList,
            label: 'PPK < 1 Count',
            id: 'machinePpkLessThanOneCount',
            stack: 'total'
        },
    ]}
    yAxis={[{ label: 'PPK <1 Count' }]}
    margin={{
        left: 80,
        bottom: 100,
    }}
/>
                                </div>
                            </Grid>
                            <Grid item xs={12} lg={4} sx={{ minWidth: 300, overflow: 'auto' }}>
                                <Typography sx={{ mb: 2 }} variant="h6">
                                    Top 3 Machines PPK Less Than 1 Detail
                                </Typography>
                                {machineNCData.slice(0, 3).map((item, index) => (
                                    <Grid item xs={12} key={index}>
                                        <Card sx={{ width: '560', padding: 0 }}>
                                            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: 0, '&:last-child': { paddingBottom: 1 } }}>
                                                <Box sx={{ backgroundColor: '#3e3e3e', width: '100%', textAlign: 'center', padding: 1, mb: 1 }}>
                                                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}><span>{item.MachineId}</span></Typography>
                                                </Box>
                                                <Grid container spacing={0} direction="row" sx={{ justifyContent: 'center', m: 0 }}>
                                                    <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, backgroundColor: '#232738', py: 2 }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}><span>{item.PPK_Less_Than_One_Percentage}%</span></Typography>
                                                        <Typography variant="h7">PPK &lt;1 Percentage</Typography>
                                                    </Grid>
                                                    <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, backgroundColor: '#232738', borderLeft: '15px solid #121212' }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}><span>{item.PPK_Less_Than_One_Count}</span></Typography>
                                                        <Typography variant="h7">PPK &lt;1 Lots</Typography>
                                                    </Grid>
                                                    <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, backgroundColor: '#232738', borderLeft: '15px solid #121212' }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}><span>{item.PPK_Greater_Than_One_Count}</span></Typography>
                                                        <Typography variant="h7">PPK &gt;1 Lots</Typography>
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Grid>
                        <Grid container spacing={2} direction="row" sx={{ mt: 1 }}>
                            <Grid item xs={8} sx={{ minWidth: 0 }}>
                                <Typography variant="h6">Top 10 Materials PPK Less Than 1 Count</Typography>
                                <div className="custom-x-padding-bottom">
                                    <BarChart
                                        width={1200}
                                        height={500}
                                        margin={{
                                            left: 80,
                                            bottom: 100,
                                        }}
                                        series={[
                                            {
                                                data: materialPpkLessThanOneCountList,
                                                label: 'PPK < 1 Count',
                                                id: 'materialPpkLessThanOneCount',
                                                stack: 'total',
                                            },
                                        ]}
                                        xAxis={[
                                            {
                                                data: materialIdList.map(item => {
                                                    if (!item) return '';
                                                    const words = item.split(' ');
                                                    if (words[0] && words[0].length > 15) {
                                                        return words[0].substring(0, 10) + '...\n' + words.slice(1).join('\n');
                                                    }
                                                    return item.split(' ').join('\n');
                                                }),
                                                scaleType: 'band',
                                                label: 'Material Desc',
                                                labelOffset: 100,
                                                labelStyle: { marginBottom: 9000 },
                                                height: 50,
                                            },
                                        ]}
                                        yAxis={[{
                                            label: 'PPK < 1 Count',
                                            width: 100
                                        }]}
                                    />
                                </div>
                            </Grid>
                            <Grid item xs={4} sx={{ alignItem: 'end', overflow: 'auto' }}>
                                <Typography sx={{ mb: 2 }} variant="h6">
                                    Top 3 Materials PPK Less Than 1 Detail
                                </Typography>
                                {materialNCData.slice(0, 3).map((item, index) => (
                                    <Grid item xs={12} key={index}>
                                        <Card sx={{ width: '560', padding: 0 }}>
                                            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: 0, '&:last-child': { paddingBottom: 1 } }}>
                                                <Box sx={{ backgroundColor: '#3e3e3e', width: '100%', textAlign: 'center', padding: 1, mb: 1 }}>
                                                    <Typography variant="h5" sx={{ fontWeight: 'bold' }}><span>{item.MaterialDesc}</span></Typography>
                                                </Box>
                                                <Grid container spacing={0} direction="row" sx={{ justifyContent: 'center', m: 0 }}>
                                                    <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, backgroundColor: '#232738', py: 2 }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}><span>{item.PPK_Less_Than_One_Percentage}%</span></Typography>
                                                        <Typography variant="h7">PPK &lt;1 Percentage</Typography>
                                                    </Grid>
                                                    <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, backgroundColor: '#232738', borderLeft: '15px solid #121212' }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}><span>{item.PPK_Less_Than_One_Count}</span></Typography>
                                                        <Typography variant="h7">PPK &lt;1 Lots</Typography>
                                                    </Grid>
                                                    <Grid item xs={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 0, backgroundColor: '#232738', borderLeft: '15px solid #121212' }}>
                                                        <Typography variant="h4" sx={{ fontWeight: 'bold' }}><span>{item.PPK_Greater_Than_One_Count}</span></Typography>
                                                        <Typography variant="h7">PPK &gt;1 Lots</Typography>
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        </Grid>
                    </>
                )}
            </Grid>
        </Grid>
    );
};

export default NCLotRankBar;