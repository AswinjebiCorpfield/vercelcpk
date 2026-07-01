import React, { useMemo, useState, useEffect } from 'react';
import { Box, TextField, MenuItem, Button, Typography } from '@mui/material';

const FilterPanel = ({ data, onFiltersChange }) => {
  const [filters, setFilters] = useState({
    Dept: '',
    MachineId: '',
    MaterialDesc: '',
    DimensionDesc: '',
    CAT: '',
    YearMonth: '',
    startMonth: '',
    endMonth: '',
  });
  const [searchValue, setSearchValue] = useState('');

  // 动态计算可选值
  const availableOptions = useMemo(() => {
    const options = {
      Dept: new Set(),
      MachineId: new Set(),
      MaterialDesc: new Set(),
      DimensionDesc: new Set(),
      CAT: new Set(),
    };
  
    (Array.isArray(data) ? data : []).forEach((row) => {
      const matchesFilters = Object.keys(filters).every((key) => {
        if (!filters[key] || !['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'].includes(key)) {
          return true;
        }
        return row[key]?.toString().toLowerCase().includes(filters[key].toLowerCase());
      });
  
      if (matchesFilters) {
        options.Dept.add(row.Dept);
        options.MachineId.add(row.MachineId);
        options.MaterialDesc.add(row.MaterialDesc);
        options.DimensionDesc.add(row.DimensionDesc);
        options.CAT.add(row.CAT);
      }
    });
  
    return {
      Dept: Array.from(options.Dept).sort(),
      MachineId: Array.from(options.MachineId).sort(),
      MaterialDesc: Array.from(options.MaterialDesc).sort(),
      DimensionDesc: Array.from(options.DimensionDesc).sort(),
      CAT: Array.from(options.CAT).sort(),
    };
  }, [data, filters]);

  // 动态计算月份字段
  const monthFields = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0])
      .slice(5) // 假设前 5 个字段是固定的
      .filter((key) => /^\d{4}-\d{2}/.test(key)) // 筛选出符合 YYYY-MM 格式的字段
      .sort((a, b) => (a > b ? 1 : -1));
  }, [data]);

  // 通知父组件筛选结果
  useEffect(() => {
    const filteredData = data.filter((row) => {
      const matchesFilters = Object.keys(filters).every((key) => {
        if (!filters[key]) return true;
        return row[key]?.toString().toLowerCase().includes(filters[key].toLowerCase());
      });

      if (searchValue) {
        return matchesFilters && Object.values(row).some((value) =>
          value?.toString().toLowerCase().includes(searchValue.toLowerCase())
        );
      }

      return matchesFilters;
    });

    onFiltersChange(filteredData); // 将筛选结果传递给父组件
  }, [filters, searchValue, data, onFiltersChange]);

  // 高亮匹配的字符
  const highlightMatch = (text, query) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) =>
      regex.test(part) ? (
        <Typography component="span" key={index} sx={{ backgroundColor: 'yellow' }}>
          {part}
        </Typography>
      ) : (
        part
      )
    );
  };

  // 更新筛选条件
  const handleFilterChange = (key, value) => {
    setFilters((prevFilters) => ({ ...prevFilters, [key]: value }));
  };

  // 更新搜索值
  const handleSearchChange = (value) => {
    setSearchValue(value);
  };

  // 清除所有筛选条件
  const handleClearFilters = () => {
    setFilters({
      Dept: '',
      MachineId: '',
      MaterialDesc: '',
      DimensionDesc: '',
      CAT: '',
      YearMonth: '',
      startMonth: '',
      endMonth: '',
    });
    setSearchValue('');
  };

  return (
    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {/* Search 输入框 */}
      <TextField
        label="Search"
        value={searchValue}
        onChange={(e) => handleSearchChange(e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 300 }}
        placeholder="Search across all fields"
      />

      {/* 联动筛选字段 */}
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
          {availableOptions[key].map((value) => (
            <MenuItem key={value} value={value}>
              {highlightMatch(value, searchValue)}
            </MenuItem>
          ))}
        </TextField>
      ))}

      {/* Year/Month 筛选 */}
      <TextField
        select
        label="Filter by Year/Month"
        value={filters.YearMonth || ''}
        onChange={(e) => handleFilterChange('YearMonth', e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">All</MenuItem>
        {monthFields.map((month) => (
          <MenuItem key={month} value={month}>
            {highlightMatch(month.slice(0, 7), searchValue)}
          </MenuItem>
        ))}
      </TextField>

      {/* Start Month 筛选 */}
      <TextField
        select
        label="Filter by Start Month"
        value={filters.startMonth || ''}
        onChange={(e) => handleFilterChange('startMonth', e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">All</MenuItem>
        {monthFields.map((month) => (
          <MenuItem key={month} value={month}>
            {highlightMatch(month.slice(0, 7), searchValue)}
          </MenuItem>
        ))}
      </TextField>

      {/* End Month 筛选 */}
      <TextField
        select
        label="Filter by End Month"
        value={filters.endMonth || ''}
        onChange={(e) => handleFilterChange('endMonth', e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">All</MenuItem>
        {monthFields.map((month) => (
          <MenuItem key={month} value={month}>
            {highlightMatch(month.slice(0, 7), searchValue)}
          </MenuItem>
        ))}
      </TextField>

      {/* 清除筛选按钮 */}
      <Button variant="outlined" color="secondary" onClick={handleClearFilters}>
        Clear Filters
      </Button>
    </Box>
  );
};

export default FilterPanel;