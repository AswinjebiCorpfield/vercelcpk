import React, { useState, useMemo, useEffect } from 'react';
import { Box, TextField, MenuItem, Button } from '@mui/material';

const FILTER_STORAGE_KEY = 'filterManagerState';

const FilterManager = ({ data, onFilterUpdate }) => {
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
  const [globalSearch, setGlobalSearch] = useState('');

  // 从 localStorage 恢复筛选值
  useEffect(() => {
    const savedFilters = localStorage.getItem(FILTER_STORAGE_KEY);
    if (savedFilters) {
      const parsedFilters = JSON.parse(savedFilters);
      setFilters(parsedFilters.filters || {});
      setGlobalSearch(parsedFilters.globalSearch || '');
    }
  }, []);

  // 保存筛选值到 localStorage
  useEffect(() => {
    localStorage.setItem(
      FILTER_STORAGE_KEY,
      JSON.stringify({ filters, globalSearch })
    );
  }, [filters, globalSearch]);

  // 动态计算可选值
  const availableOptions = useMemo(() => {
    const options = {
      Dept: new Set(),
      MachineId: new Set(),
      MaterialDesc: new Set(),
      DimensionDesc: new Set(),
      CAT: new Set(),
    };

    data.forEach((row) => {
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

  // 更新筛选条件
  const handleFilterChange = (key, value) => {
    const updatedFilters = { ...filters, [key]: value };
    setFilters(updatedFilters);
    applyFilters(updatedFilters, globalSearch);
  };

  // 更新全局搜索值
  const handleGlobalSearchChange = (value) => {
    setGlobalSearch(value);
    applyFilters(filters, value);
  };

  // 应用筛选逻辑
  const applyFilters = (updatedFilters, searchValue) => {
    let filtered = data;

    Object.keys(updatedFilters).forEach((key) => {
      if (updatedFilters[key] && key !== 'YearMonth' && key !== 'startMonth' && key !== 'endMonth') {
        filtered = filtered.filter((row) =>
          row[key]?.toString().toLowerCase().includes(updatedFilters[key].toLowerCase())
        );
      }
    });

    if (updatedFilters.YearMonth) {
      filtered = filtered
        .map((row) => {
          const monthField = Object.keys(row).find((field) =>
            field.startsWith(updatedFilters.YearMonth.slice(0, 7))
          );

          if (monthField) {
            const keys = Object.keys(row);
            const firstFiveKeys = keys.slice(0, 5);
            const newObj = {};

            firstFiveKeys.forEach((key) => {
              newObj[key] = row[key];
            });

            newObj[monthField] = row[monthField];
            return newObj;
          }
          return null;
        })
        .filter(Boolean);
    }

    const startMonth = updatedFilters.startMonth;
    const endMonth = updatedFilters.endMonth;

    if (startMonth && endMonth) {
      filtered = filtered
        .map((row) => {
          const monthFields = Object.keys(row).filter((field) => {
            const month = field.slice(0, 7);
            return month >= startMonth.slice(0, 7) && month <= endMonth.slice(0, 7);
          });

          if (monthFields.length > 0) {
            const keys = Object.keys(row);
            const firstFiveKeys = keys.slice(0, 5);
            const newObj = {};

            firstFiveKeys.forEach((key) => {
              newObj[key] = row[key];
            });

            monthFields.forEach((monthField) => {
              newObj[monthField] = row[monthField];
            });

            return newObj;
          }

          return null;
        })
        .filter(Boolean);
    }

    if (searchValue) {
      filtered = filtered.filter((row) =>
        Object.values(row).some((value) =>
          value?.toString().toLowerCase().includes(searchValue.toLowerCase())
        )
      );
    }

    onFilterUpdate(filtered);
  };

  // 清除所有筛选条件
  const handleClearFilters = () => {
    const clearedFilters = {
      Dept: '',
      MachineId: '',
      MaterialDesc: '',
      DimensionDesc: '',
      CAT: '',
      YearMonth: '',
      startMonth: '',
      endMonth: '',
    };
    setFilters(clearedFilters);
    setGlobalSearch('');
    onFilterUpdate(data);
    localStorage.removeItem(FILTER_STORAGE_KEY); // 清除存储的筛选值
  };

  return (
    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <TextField
        label="Global Search"
        value={globalSearch}
        onChange={(e) => handleGlobalSearchChange(e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 300 }}
        placeholder="Search across all fields"
      />

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
              {value}
            </MenuItem>
          ))}
        </TextField>
      ))}

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
            {month.slice(0, 7)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Filter by Start Year/Month"
        value={filters.startMonth || ''}
        onChange={(e) => handleFilterChange('startMonth', e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">All</MenuItem>
        {monthFields.map((month) => (
          <MenuItem key={month} value={month}>
            {month.slice(0, 7)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        label="Filter by End Year/Month"
        value={filters.endMonth || ''}
        onChange={(e) => handleFilterChange('endMonth', e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 200 }}
      >
        <MenuItem value="">All</MenuItem>
        {monthFields
          .filter((month) => !filters.startMonth || month.slice(0, 7) > filters.startMonth.slice(0, 7))
          .map((month) => (
            <MenuItem key={month} value={month}>
              {month.slice(0, 7)}
            </MenuItem>
          ))}
      </TextField>

      <Button variant="outlined" color="secondary" onClick={handleClearFilters}>
        Clear Filters
      </Button>
    </Box>
  );
};

export default FilterManager;