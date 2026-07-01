import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import axios from 'axios';

const MonthlyHistoricalOverallLots = () => {
  const [data, setData] = useState([]);
  const [isCPK, setIsCPK] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0); // 当前页码
  const [rowsPerPage, setRowsPerPage] = useState(10); // 每页显示的行数
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const response = await axios.get(
          `http://localhost:5259/overall-lots-cpk-ppk-summary-monthly?isCPK=${isCPK}`
        );
        if (response.status === 200) {
          setData(response.data);
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
    const selectedData = {
      Dept,
      MachineId,
      MaterialDesc,
      DimensionDesc,
      CAT,
    };
    navigate('/subsample-scatter', { state: { selectedData } });
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // 重置到第一页
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
        {isCPK ? 'CPK' : 'PPK'}
      </Button>
      <Typography sx={{ color: 'aliceblue' }}>{`Displaying ${
        isCPK ? 'CPK' : 'PPK'
      } data\n`}</Typography>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <CircularProgress disableShrink color="primary" sx={{ height: '100vh' }} />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Dept</TableCell>
                  <TableCell>MachineId</TableCell>
                  <TableCell>Template</TableCell>
                  <TableCell>DimensionDesc</TableCell>
                  <TableCell>CAT</TableCell>
                  {data.length > 0 &&
                    Object.keys(data[0])
                      .slice(5)
                      .map((col, index) => (
                        <TableCell key={index}>{col.slice(0, 7)}</TableCell>
                      ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage) // 分页数据
                  .map((row, index) => (
                    <TableRow
                      key={index}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => handleRowClick(row)}
                    >
                      <TableCell>{row.Dept}</TableCell>
                      <TableCell>{row.MachineId}</TableCell>
                      <TableCell>{row.Template}</TableCell>
                      <TableCell>{row.DimensionDesc}</TableCell>
                      <TableCell>{row.CAT}</TableCell>
                      {Object.values(row)
                        .slice(5)
                        .map((value, colIndex) => {
                          const numValue = parseFloat(value);
                          const shouldHighlight =
                            typeof numValue === 'number' &&
                            isFinite(numValue) &&
                            numValue < 1.0;
                          return (
                            <TableCell
                              key={colIndex}
                              sx={{
                                backgroundColor: shouldHighlight ? 'red' : 'transparent',
                              }}
                            >
                              {value}
                            </TableCell>
                          );
                        })}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]} // 可选的每页行数
            component="div"
            count={data.length} // 总行数
            rowsPerPage={rowsPerPage} // 当前每页行数
            page={page} // 当前页码
            onPageChange={handleChangePage} // 页码改变时的回调
            onRowsPerPageChange={handleChangeRowsPerPage} // 每页行数改变时的回调
          />
        </>
      )}
    </Box>
  );
};

export default MonthlyHistoricalOverallLots;