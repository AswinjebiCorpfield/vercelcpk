import React, { useState, useMemo, useEffect } from 'react';
import { Box, TextField, MenuItem, Button, IconButton, Tooltip } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import InputAdornment from '@mui/material/InputAdornment';
import CloseIcon from '@mui/icons-material/Close';
import { useValue } from '../context/ContextProvider';

const highlightStyle = {
  backgroundColor: 'yellow',
  color: 'black',
};

function formatMonthYear(monthStr) {
  if (!monthStr) return '';
  // 支持202401/2024-01/2024-01-01等格式
  if (/^\d{6}$/.test(monthStr)) {
    const year = monthStr.slice(0, 4);
    const month = monthStr.slice(4, 6);
    const date = new Date(`${year}-${month}-01`);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`;
  }
  if (/^\d{4}-\d{2}$/.test(monthStr)) {
    const [year, month] = monthStr.split('-');
    const date = new Date(`${year}-${month}-01`);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${year}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(monthStr)) {
    const date = new Date(monthStr);
    return `${date.toLocaleString('en-US', { month: 'short' })} ${date.getFullYear()}`;
  }
  return monthStr;
}

const toSixDigitMonth = (monthStr) => {
  if (!monthStr) return '';
  const str = `${monthStr}`;
  if (/^\d{6}$/.test(str)) return str;
  if (/^\d{4}-\d{2}$/.test(str)) return str.replace('-', '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str.slice(0, 7).replace('-', '');
  return '';
};

// 辅助函数：计算最近12个月的最前月份
const getRecent12MonthsStart = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${y}${m}`;
};

// 辅助函数：计算最新的月份
const getCurrentMonth = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  return `${y}${m}`;
};

const FILTER_KEYS = ['Dept', 'MachineId', 'MaterialDesc', 'DimensionDesc', 'CAT'];

const FilterManager = ({ data, filters = {}, setFilters, onFilterUpdate, monthOptions, leading }) => {
  const { dispatch } = useValue();
  const [globalSearch, setGlobalSearch] = useState('');
  const [clearKeys, setClearKeys] = useState(
    () => Object.fromEntries(FILTER_KEYS.filter(k => k !== 'CAT').map(k => [k, 0]))
  );

  const normalizeMonth = (month) => toSixDigitMonth(month);
  console.log('FilterManager rendered with filters:', filters);
  console.log('【DEBUG】monthOptions from parent:', monthOptions);
  // 规范化 filters，确保 CAT 总是数组
  useEffect(() => {
    if (filters.CAT && !Array.isArray(filters.CAT)) {
      setFilters({ ...filters, CAT: [filters.CAT] });
    }
  }, []);

  // 前端本地计算可选项（联动：每个字段的options受其他filters影响）
  const availableOptions = useMemo(() => {
    const options = {};
    FILTER_KEYS.forEach(k => (options[k] = new Set()));
    
    // ===== 核心逻辑：根据当前【有值】的filters条件进行联动 =====
    let filtered = data;
    
    // 1. 用所有有值的conditions过滤数据
    FILTER_KEYS.forEach((filterKey) => {
      if (filterKey === 'CAT' && Array.isArray(filters[filterKey]) && filters[filterKey].length > 0) {
        // CAT多选：有值就过滤
        filtered = filtered.filter(row =>
          filters[filterKey].includes(row[filterKey])
        );
      } else if (filterKey !== 'CAT' && filters[filterKey] && filters[filterKey] !== '') {
        // 其他单选：有值就过滤
        filtered = filtered.filter(row =>
          row[filterKey]?.toString().toLowerCase().includes(filters[filterKey].toLowerCase())
        );
      }
    });
    
    // 2. 从过滤后的数据提取各字段的选项
    filtered.forEach(row => {
      FILTER_KEYS.forEach(key => {
        if (row[key]) options[key].add(row[key]);
      });
    });
    
    // 3. 特殊处理：CAT多选字段始终显示全部选项（不受联动限制）
    data.forEach(row => {
      if (row['CAT']) options['CAT'].add(row['CAT']);
    });
    
    return Object.fromEntries(
      Object.entries(options).map(([k, v]) => [k, Array.from(v).sort()])
    );
  }, [data, filters]);

  const allMonthFields = useMemo(() => {
    const monthSet = new Set();
    if (monthOptions && monthOptions.length) {
      console.log('【DEBUG】Using monthOptions from parent, length:', monthOptions.length);
      monthOptions.forEach(value => {
        const sixDigit = toSixDigitMonth(value);
        if (sixDigit) monthSet.add(sixDigit);
      });
    } else {
      console.log('【DEBUG】monthOptions empty, using fallback from data');
      // Fallback: 从data中提取，但只收集有真实数据的月份
      data.forEach(row => {
        Object.keys(row).forEach(key => {
          if (/^\d{6}$/.test(key)) {
            const value = row[key];
            // 如果值不是空/null/"-"，则认为这个月份有真实数据
            if (value !== null && value !== undefined && value !== '' && value !== ' - ') {
              monthSet.add(key);
            }
          }
        });
      });
    }
    const result = Array.from(monthSet).sort((a, b) => a.localeCompare(b));
    console.log('【DEBUG】allMonthFields computed:', result);
    return result;
  }, [monthOptions, data]);

  const StartMonthOptions = useMemo(() => {
    if (filters.EndMonth) {
      return allMonthFields.filter(month => month <= filters.EndMonth);
    }
    return allMonthFields;
  }, [allMonthFields, filters.EndMonth]);

  const EndMonthOptions = useMemo(() => {
    if (filters.StartMonth) {
      return allMonthFields.filter(month => month >= filters.StartMonth);
    }
    return allMonthFields;
  }, [allMonthFields, filters.StartMonth]);

  // filters变化自动apply
  useEffect(() => {
    applyFilters(filters, globalSearch);
    // eslint-disable-next-line
  }, [filters, data]);

  // 监听monthOptions变化时重新应用filters（确保options立即更新）
  // useEffect(() => {
  //   console.log('【DEBUG】monthOptions changed, triggering re-apply:', allMonthOptions);
  // }, [allMonthOptions]);

  // 更新筛选条件（全局filters和本地filters同步）
  const handleFilterChange = (key, value) => {
    console.log(`【DEBUG】handleFilterChange: key=${key}, value='${value}'`);
    
    if (key === 'StartMonth') {
      // "All" 或空字符串都表示清除
      if (value === '' || value === 'All') {
        console.log('【DEBUG】Clearing StartMonth only');
        const updatedFilters = { ...filters, StartMonth: '' };
        setFilters(updatedFilters);
        dispatch({ type: 'UPDATE_FILTERS', payload: updatedFilters });
        return;
      }
      // 设置新值
      const start = normalizeMonth(value);
      let end = filters.EndMonth ? normalizeMonth(filters.EndMonth) : '';
      if (start && !end) {
        end = allMonthFields[allMonthFields.length - 1] || start;
      }
      if (start && end && end < start) end = start;
      const updatedFilters = { ...filters, StartMonth: start, EndMonth: end };
      setFilters(updatedFilters);
      dispatch({ type: 'UPDATE_FILTERS', payload: updatedFilters });
      return;
    }
    
    if (key === 'EndMonth') {
      // "All" 或空字符串都表示清除
      if (value === '' || value === 'All') {
        console.log('【DEBUG】Clearing EndMonth only');
        const updatedFilters = { ...filters, EndMonth: '' };
        setFilters(updatedFilters);
        dispatch({ type: 'UPDATE_FILTERS', payload: updatedFilters });
        return;
      }
      // 设置新值
      const end = normalizeMonth(value);
      let start = filters.StartMonth ? normalizeMonth(filters.StartMonth) : '';
      if (end && !start) {
        start = allMonthFields[0] || end;
      }
      if (start && end && start > end) start = end;
      const updatedFilters = { ...filters, StartMonth: start, EndMonth: end };
      setFilters(updatedFilters);
      dispatch({ type: 'UPDATE_FILTERS', payload: updatedFilters });
      return;
    }
    let val = value;
    if (key === 'CAT') {
      // CAT多选：过滤掉空值，保留非空字符串
      val = Array.isArray(value) ? value.filter(v => v && v.trim() !== '') : [];
    } else if (key === 'YearMonth') {
      val = normalizeMonth(value);
    }
    const updatedFilters = { ...filters, [key]: val };
    setFilters(updatedFilters);
    dispatch({ type: 'UPDATE_FILTERS', payload: updatedFilters });
  };

  // 全局搜索
  const handleGlobalSearchChange = (value) => {
    setGlobalSearch(value);
    applyFilters(filters, value);
  };

  // 应用筛选逻辑
  const applyFilters = (updatedFilters, searchValue) => {
    console.log('【DEBUG】applyFilters called with:', updatedFilters);
    let filtered = data;

    // 1. 普通字段过滤
    FILTER_KEYS.forEach((key) => {
      if (key === 'CAT' && Array.isArray(updatedFilters[key]) && updatedFilters[key].length > 0) {
        // CAT是数组且非空时才过滤
        filtered = filtered.filter(row =>
          updatedFilters[key].includes(row[key])
        );
      } else if (key !== 'CAT' && updatedFilters[key]) {
        // 其他字段的单选过滤
        filtered = filtered.filter(row =>
          row[key]?.toString().toLowerCase().includes(updatedFilters[key].toLowerCase())
        );
      }
      // 如果CAT为空数组或未定义，则不应用CAT过滤（显示所有）
    });

    // 2. 按月份范围过滤列 - 仅当有日期范围或YearMonth过滤时才裁剪
    const hasMonthFilter = updatedFilters.StartMonth || updatedFilters.EndMonth || updatedFilters.YearMonth;
    console.log('【DEBUG】hasMonthFilter:', hasMonthFilter, 'StartMonth:', updatedFilters.StartMonth, 'EndMonth:', updatedFilters.EndMonth);
    if (hasMonthFilter) {
      filtered = filtered.map(row => {
        const base = {};
        FILTER_KEYS.forEach(key => (base[key] = row[key]));
        
        // YearMonth 精确到单月优先级最高
        if (updatedFilters.YearMonth) {
          const month = normalizeMonth(updatedFilters.YearMonth);
          if (month && row[month] !== undefined) base[month] = row[month];
        } else {
          // 按月份范围过滤
          let monthFields = [...allMonthFields];
          if (updatedFilters.StartMonth) {
            monthFields = monthFields.filter(month => month >= updatedFilters.StartMonth);
          }
          if (updatedFilters.EndMonth) {
            monthFields = monthFields.filter(month => month <= updatedFilters.EndMonth);
          }
          monthFields.forEach(month => {
            if (row[month] !== undefined) base[month] = row[month];
          });
        }
        return base;
      });
    }

    // 3. 全局搜索
    if (searchValue) {
      filtered = filtered.filter(row =>
        Object.values(row).some(val =>
          val?.toString().toLowerCase().includes(searchValue.toLowerCase())
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
      CAT: [], // 空数组表示不过滤CAT，显示所有CAT的数据
      YearMonth: '',
      StartMonth: '',
      EndMonth: '',
    };
    setFilters(clearedFilters);
    dispatch({ type: 'UPDATE_FILTERS', payload: clearedFilters });
    setGlobalSearch('');
    console.log('【DEBUG】All filters cleared, triggering complete data refresh');
    onFilterUpdate(data);
  };

  return (
    <Box className="filter-area" sx={{
      mb: 2, display: 'flex', alignItems: 'flex-end', gap: 1, flexWrap: 'wrap', position: 'sticky',
      top: 0, zIndex: 1, backgroundColor: 'background.paper', border: '1px solid', borderColor: 'divider',
      padding: '12px 14px', borderRadius: '10px'
    }}>
      {leading}
      <TextField
        label="Search"
        value={globalSearch}
        onChange={(e) => handleGlobalSearchChange(e.target.value)}
        variant="outlined"
        size="small"
        sx={{ minWidth: 160 }}
        placeholder="Search across all fields"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
        }}
      />
      {FILTER_KEYS.map((key) => {
        const isCAT = key === 'CAT';
        const filterValue = isCAT ? (Array.isArray(filters[key]) ? filters[key] : []) : (filters[key] ?? '');
        const baseOptions = isCAT ? availableOptions[key] : ['', ...availableOptions[key]];
        // Ensure current value is always in options — prevents MUI v6 from showing empty input when data is still loading
        const options = (!isCAT && filterValue && !baseOptions.includes(filterValue))
          ? [...baseOptions, filterValue]
          : baseOptions;
        const hasValue = !isCAT && (filterValue !== '');
        return (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Autocomplete
              key={isCAT ? key : `${key}_${clearKeys[key] ?? 0}`}
              multiple={isCAT}
              options={options}
              value={filterValue}
              onChange={(e, value) => handleFilterChange(key, value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={key}
                  variant="outlined"
                  sx={{ minWidth: 138 }}
                  placeholder={isCAT ? 'Select CAT (all if none)' : 'All'}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <InputAdornment position="end">
                        {hasValue && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFilterChange(key, isCAT ? [] : '');
                              if (!isCAT) setClearKeys(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
                            }}
                            sx={{ p: 0.5, mr: 0.5 }}
                            title={`Clear ${key}`}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        )}
                        {params.InputProps?.endAdornment}
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            size="small"
            getOptionLabel={option => option === '' ? '' : option}
            isOptionEqualToValue={(option, value) => {
              if (isCAT) {
                return Array.isArray(value) ? value.includes(option) : value === option;
              }
              return option === value;
            }}
            disableClearable={isCAT ? false : true}
            ListboxProps={{ style: { maxHeight: 300 } }}
            renderOption={(props, option) => {
              if (isCAT) {
                return (
                  <li
                    {...props}
                    style={
                      Array.isArray(filters[key]) && filters[key].includes(option)
                        ? highlightStyle
                        : {}
                    }
                  >
                    {option}
                  </li>
                );
              }
              return (
                <li
                  {...props}
                  style={
                    option !== '' && filters[key] === option
                      ? highlightStyle
                      : {}
                  }
                >
                  {option === '' ? 'All' : option}
                </li>
              );
            }}
            clearOnBlur={false}
            selectOnFocus
            handleHomeEndKeys
            freeSolo={false}
            sx={{ minWidth: 138 }}
          />
          </Box>
        );
      })}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Autocomplete
        size= "small"
          options={StartMonthOptions}
          value={filters.StartMonth || getRecent12MonthsStart()}
          onChange={(e, value) => {
            if (value === getRecent12MonthsStart() && !filters.StartMonth) {
              handleFilterChange('StartMonth', '');
            } else {
              handleFilterChange('StartMonth', value);
            }
          }}
          renderInput={params => (
            <TextField
              {...params}
              label="Start Month"
              variant="outlined"
              sx={{ minWidth: 138 }}
              placeholder="All"
            />
          )}
          getOptionLabel={option => formatMonthYear(option)}
          isOptionEqualToValue={(option, value) => option === value}
          disableClearable={false}
          ListboxProps={{ style: { maxHeight: 300, minHeight: 200 } }}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <li key={option} {...rest}>
                {formatMonthYear(option)}
              </li>
            );
          }}
          renderTags={() => null}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Autocomplete
        size= "small"
          options={EndMonthOptions}
          value={filters.EndMonth || getCurrentMonth()}
          onChange={(e, value) => {
            if (value === getCurrentMonth() && !filters.EndMonth) {
              handleFilterChange('EndMonth', '');
            } else {
              handleFilterChange('EndMonth', value);
            }
          }}
          renderInput={params => (
            <TextField
              {...params}
              label="End Month"
              variant="outlined"
              sx={{ minWidth: 138, maxHeight: 300 }}
              placeholder="All"
            />
          )}
          getOptionLabel={option => formatMonthYear(option)}
          isOptionEqualToValue={(option, value) => option === value}
          disableClearable={false}
          ListboxProps={{ style: { maxHeight: 300, minHeight: 200 } }}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <li key={option} {...rest}>
                {formatMonthYear(option)}
              </li>
            );
          }}
          renderTags={() => null}
        />
      </Box>
      <Tooltip title="Clear all filters">
        <IconButton
          onClick={handleClearFilters}
          sx={{ ml: 'auto', mb: 0.25, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, color: 'text.secondary', '&:hover': { color: 'error.main', borderColor: 'error.main' } }}
        >
          <FilterAltOffIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default FilterManager;