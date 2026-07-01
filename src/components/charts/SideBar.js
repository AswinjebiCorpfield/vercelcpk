import * as React from 'react';
import PropTypes from 'prop-types';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import { ToggleButton, ToggleButtonGroup, Button, Collapse, IconButton, Stack } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

const drawerWidth = 320;

const departments = ['Department 1', 'Department 2', 'Department 3'];
const parts = ['Part 1', 'Part 2', 'Part 3'];
const machines = ['Machine 1', 'Machine 2', 'Machine 3'];
const categories = ['Category 1', 'Category 2', 'Category 3'];

function SideBar(props) {
  const {
    window,
    figureDisplay,
    handleFigureDisplayChange,
    dateTypeDisplay,
    handleDateTypeDisplayChange,
    onApplyFilters,
  } = props;
  const [startDate, setStartDate] = React.useState(null);
  const [endDate, setEndDate] = React.useState(null);
  const [department, setDepartment] = React.useState('');
  const [partName, setPartName] = React.useState('');
  const [machine, setMachine] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [expanded, setExpanded] = React.useState(true);

  const container = window !== undefined ? () => window().document.body : undefined;

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const handleApplyFilters = () => {
    onApplyFilters({
      startDate,
      endDate,
      department,
      partName,
      machine,
      category,
    });
  };

  return (
    <Drawer
      container={container}
      variant="permanent"
      position="static"
      sx={{
        mr: 100,
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box', top: '64px' },
      }}
    >
      <List>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="h6">Filters</Typography>
          <IconButton onClick={handleExpandClick}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>
        <Collapse in={expanded}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <ListItem>
              <DatePicker
                label="Start Date"
                fullWidth
                sx={{
                  width: "100%",
                }}
                value={startDate}
                onChange={(newValue) => setStartDate(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="medium"
                    fullWidth
                    sx={{
                      '& .MuiInputBase-input': {
                        padding: '8px 14px', // 调整input内的padding值，这里设置为上下8px，左右14px
                      },
                    }}
                  />
                )}
              />
            </ListItem>
            <ListItem>
              <DatePicker
                label="End Date"
                value={endDate}
                sx={{
                  width: "100%",
                }}
                onChange={(newValue) => setEndDate(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    fullWidth
                    sx={{
                      '& .MuiInputBase-input': {
                        padding: '8px 14px', // 调整input内的padding值，这里设置为上下8px，左右14px
                      },
                    }}
                  />
                )}
              />
            </ListItem>
          </LocalizationProvider>
          <ListItem>
            <TextField
              select
              label="Department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              fullWidth
              size="large"
              margin="dense"
            >
              {departments.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </ListItem>
          <ListItem>
            <TextField
              select
              label="Part Name"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              fullWidth
              size="large"
              margin="dense"
            >
              {parts.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </ListItem>
          <ListItem>
            <TextField
              select
              label="Dimension Description"
              value={partName}
              onChange={(e) => setPartName(e.target.value)}
              fullWidth
              size="large"
              margin="dense"
            >
              {parts.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </ListItem>
          <ListItem>
            <TextField
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              size="large"
              margin="dense"
            >
              {categories.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </ListItem>
          <ListItem>
            <TextField
              select
              label="Machine"
              value={machine}
              onChange={(e) => setMachine(e.target.value)}
              fullWidth
              size="large"
              margin="dense"
            >
              {machines.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </ListItem>
          <ListItem>
            <Button variant="contained" color="primary" fullWidth onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </ListItem>
        </Collapse>
      </List>
    </Drawer>
  );
}

SideBar.propTypes = {
  window: PropTypes.func,
  figureDisplay: PropTypes.string.isRequired,
  handleFigureDisplayChange: PropTypes.func.isRequired,
  dateTypeDisplay: PropTypes.string.isRequired,
  handleDateTypeDisplayChange: PropTypes.func.isRequired,
  onApplyFilters: PropTypes.func.isRequired,
};

export default SideBar;