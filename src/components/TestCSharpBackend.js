import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box } from '@mui/material';
import cors from 'cors';

const TestCSharpBackend = () => {

      const [data, setData] = useState([]);
    
      useEffect(() => {
        axios({method:'get',
          url: 'http://localhost:5175/games',
          withCredentials: false,
          })
            .then(response => {
              setData(response.data);
              console.log('Data from C# backend:', response.data);
            })
            .catch(error => console.error('Error fetching data from C# backend:', error));
      }, []);
      
      return (
        <Box sx={{ m: 200, backgroundColor: 'lightblue' }}>
          <div>TestCSharpBackend</div>
          <div>
            {data.length > 0 ? (
              <ul>
                {data.map((item, index) => (
                  <li key={index}>
                    {`BatchMC3: ${item.BatchMC3}, BatchMC4: ${item.BatchMC4}, Index: ${item.index}`}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No data available</p>
            )}
          </div>
        </Box>
      );
    };

export default TestCSharpBackend