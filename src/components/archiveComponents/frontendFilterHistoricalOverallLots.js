import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TablePagination,
  TextField,
  MenuItem,
} from '@mui/material';
import axios from 'axios';
import e from 'cors';

const MonthlyHistoricalOverallLots = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]); // 最终展示的过滤后数据（含列过滤）
  const [isCPK, setIsCPK] = useState(true);
  const [month, setMonth] = useState({
    startMonth: '',
    endMonth: '',
  }); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(500);
  const [filters, setFilters] = useState({
    Dept: '',
    MachineId: '',
    MaterialDesc: '',
    DimensionDesc: '',
    CAT: '',
    YearMonth: '', // 格式为 "YYYY-MM-01"（如 "2024-02-01"）
  });
  const [globalSearch, setGlobalSearch] = useState('');
  const navigate = useNavigate();

  // 固定前5列的字段名（根据你的实际数据调整）
  const FIXED_COLUMNS = ['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'];

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5259/overall-lots-cpk-ppk-summary-monthly?isCPK=${isCPK}&month=${month}`
        );
        if (response.status === 200) {
          // 假设返回的数据中，月份列名格式为 "YYYY-MM-01"（如 "2024-02-01"）
          setData(response.data);
          setFilteredData(response.data);
        } else {
          throw new Error(`Request failed with status code ${response.status}`);
        }
      } catch (err) {
        setError(err.message);
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [isCPK]);

  const handleRowClick = (row) => {
    const { Dept, MachineId, MaterialDesc, DimensionDesc, CAT } = row;
    navigate('/subsample-scatter', { state: { Dept, MachineId, MaterialDesc, DimensionDesc, CAT } });
  };

  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({...prev, [key]: value}));
  };

  const handleGlobalSearchChange = (value) => setGlobalSearch(value);

  // 核心：记忆化过滤逻辑（行+列过滤）
  const applyFilters = useMemo(() => () => {
    // 1. 行过滤（基础条件：字段过滤 + 全局搜索）
    let rowFiltered = [...data];

    // 字段过滤（Dept/MachineId等）
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key!== 'YearMonth') {
        rowFiltered = rowFiltered.filter(row => 
          row[key]?.toString().toLowerCase().includes(value.toLowerCase())
        );
      }
    });

    // 全局搜索
    if (globalSearch) {
      const searchText = globalSearch.toLowerCase();
      rowFiltered = rowFiltered.filter(row => 
        Object.values(row).some(val => 
          val?.toString().toLowerCase().includes(searchText)
        )
      );
    }

    // 2. 月份过滤（行+列）
    if (filters.YearMonth) {
      // 行过滤：仅保留选中月份列（如 "2024-02-01"）有有效值的行
      rowFiltered = rowFiltered.filter(row => {
        const monthValue = row[filters.YearMonth];
        return monthValue!== undefined && monthValue!== null && monthValue!== '';
      });

      // 列过滤：对每一行，仅保留前5列固定字段 + 选中的月份列（如 "2024-02-01"）
      rowFiltered = rowFiltered.map(row => {
        const filteredRow = { ...row };
        // 删除所有非固定列且非选中月份的列
        Object.keys(filteredRow).forEach(key => {
          if (!FIXED_COLUMNS.includes(key) && key!== filters.YearMonth) {
            delete filteredRow[key];
          }
        });
        return filteredRow;
      });
    }

    setFilteredData(rowFiltered);
    setPage(0); // 重置分页
  }, [data, filters, globalSearch, FIXED_COLUMNS]);

  // 触发过滤
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleClearFilters = () => {
    setFilters({ Dept: '', MachineId: '', MaterialDesc: '', DimensionDesc: '', CAT: '', YearMonth: '' });
    setGlobalSearch('');
    setFilteredData(data);
    setPage(0);
  };

  if (error) {
    return (
      <Box sx={{ ml: 10, marginTop: 20 }}>
        <Typography color="error">Error: {error}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ ml: 10 }}>
      <Button onClick={() => setIsCPK(!isCPK)}>
        {isCPK? 'CPK' : 'PPK'}
      </Button>
      <Typography sx={{ color: 'aliceblue' }}>{`Displaying ${isCPK? 'CPK' : 'PPK'} data`}</Typography>
      
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        {/* 全局搜索 */}
        <TextField
          label="Global Search"
          value={globalSearch}
          onChange={(e) => handleGlobalSearchChange(e.target.value)}
          variant="outlined"
          size="small"
          sx={{ minWidth: 300 }}
          placeholder="Search across all fields"
        />

        {/* 字段过滤（Dept/MachineId等） */}
        {['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'].map((key) => (
          <TextField
            key={key}
            select
            label={`Filter by ${key}`}
            value={filters[key]}
            onChange={(e) => handleFilterChange(key, e.target.value)}
            variant="outlined"
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All</MenuItem>
            {[...new Set(data.map(row => row[key]))]
              .sort()
              .map(value => (
                <MenuItem key={value} value={value}>{value}</MenuItem>
              ))}
          </TextField>
        ))}

        {/* 月份过滤（选项值为完整列名，如 "2024-02-01"） */}
        <TextField
          select
          label="Filter by Year/Month"
          value={filters.YearMonth}
          onChange={(e) => handleFilterChange('YearMonth', e.target.value)}
          variant="outlined"
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All</MenuItem>
          {data.length > 0 &&
            Object.keys(data[0])
              .filter(key =>!FIXED_COLUMNS.includes(key)) // 仅显示月份列（非固定列）
              .sort()
              .map(col => (
                <MenuItem key={col} value={col}>
                  {col} {/* 直接显示完整列名，如 "2024-02-01" */}
                </MenuItem>
              ))}
        </TextField>

        <Button variant="outlined" color="secondary" onClick={handleClearFilters}>
          Clear Filters
        </Button>
      </Box>

      {isLoading? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress disableShrink color="primary" sx={{ height: '100vh' }} />
        </Box>
      ) : (
        <>
          <TablePagination
            rowsPerPageOptions={[100, 500, 1000]}
            component="div"
            count={filteredData.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />

          <TableContainer component={Paper}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {/* 固定列（前5列） */}
                  {FIXED_COLUMNS.map((col, idx) => (
                    <TableCell key={idx}>{col}</TableCell>
                  ))}
                  {/* 动态月份列：如果有月份过滤，仅显示选中的月份列（如 "2024-02-01"） */}
                  {filters.YearMonth 
                    ? <TableCell>{filters.YearMonth}</TableCell> 
                    : Object.keys(data[0] || {})
                        .filter(key =>!FIXED_COLUMNS.includes(key)) // 非固定列（月份列）
                        .map((col, idx) => (
                          <TableCell key={idx}>{col}</TableCell>
                        ))}
                </TableRow>
              </TableHead>

              <TableBody>
                {filteredData
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, rowIdx) => (
                    <TableRow
                      key={rowIdx}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(row)}
                    >
                      {/* 固定列的值 */}
                      {FIXED_COLUMNS.map((col, idx) => (
                        <TableCell key={idx}>{row[col]}</TableCell>
                      ))}
                      {/* 动态月份列的值：如果有月份过滤，仅显示选中的月份值 */}
                      {filters.YearMonth 
                        ? <TableCell sx={{
                            backgroundColor: parseFloat(row[filters.YearMonth]) < 1? 'red' : 'transparent'
                          }}>{row[filters.YearMonth]}</TableCell> 
                        : Object.keys(row)
                            .filter(key =>!FIXED_COLUMNS.includes(key)) // 非固定列（月份列）
                            .map((col, idx) => (
                              <TableCell key={idx} sx={{
                                backgroundColor: parseFloat(row[col]) < 1? 'red' : 'transparent'
                              }}>{row[col]}</TableCell>
                            ))}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[100, 500, 1000]}
            component="div"
            count={filteredData.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </>
      )}
    </Box>
  );
};

export default MonthlyHistoricalOverallLots;