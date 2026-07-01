import React, { useMemo } from 'react';
import { Box, TextField, MenuItem, Button } from '@mui/material';

const FilterPanel = ({ data = [], filters, onFilterChange, onClearFilters }) => {
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
      if (!row || typeof row !== 'object') return;
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

  return (
    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'].map((key) => (
        <TextField
          key={key}
          select
          label={`Filter by ${key}`}
          value={filters[key]}
          onChange={(e) => onFilterChange(key, e.target.value)}
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
      <Button variant="outlined" color="secondary" onClick={onClearFilters}>
        Clear Filters
      </Button>
    </Box>
  );
};

export default FilterPanel;