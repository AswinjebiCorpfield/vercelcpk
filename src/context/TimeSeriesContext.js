import React, { createContext } from 'react';

export const TimeSeriesContext = createContext({
  isTimeSeries: false,
  setIsTimeSeries: () => {},
});
