import React from 'react';
import { Button, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ForwardIcon from '@mui/icons-material/Forward';

const BackButton = ({ sx = {}, iconSize = '4.5rem' }) => {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
      <Button
        variant="text"
        color="primary"
        size='large'
        onClick={() => navigate(-1)}
        startIcon={
          <ForwardIcon 
            sx={{ 
              transform: 'rotate(180deg)', 
              transition: 'transform 0.2s ease',
              color: 'white',
              fontSize: iconSize,
            }} 
          />
        }
      >
      </Button>
    </Box>
  );
};

export default BackButton;
