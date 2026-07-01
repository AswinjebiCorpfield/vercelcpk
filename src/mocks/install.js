import axios from 'axios';
import { fixtures } from './fixtures';
import { createMockAdapter } from './resolver.mjs';

// Demo/dummy-data mode — single source of truth for the whole app.
//
// This is the `dummydata` branch — a client UI build that runs entirely on
// captured JSON fixtures with NO backend. The data source is controlled by the
// `.env` flag REACT_APP_LIVE_DATA:
//   false / unset -> DUMMY data (mock adapter on)   [default]
//   true          -> LIVE API  (mock adapter off, real SSO)
// REACT_APP_DEMO_MODE=off/live/real still forces live too (back-compat).
const LIVE_DATA = String(process.env.REACT_APP_LIVE_DATA).toLowerCase() === 'true';
const DEMO_MODE = (process.env.REACT_APP_DEMO_MODE || 'mock').toLowerCase();
const FORCED_LIVE = ['off', 'live', 'real', 'false', '0'].includes(DEMO_MODE);
export const IS_DEMO = !LIVE_DATA && !FORCED_LIVE;

export function installMockAdapter() {
  if (!IS_DEMO) return false;
  // The mock adapter ignores host/path origin, but the app interpolates
  // `${window.baseURL}/route`, so window.baseURL must be a defined string.
  if (typeof window !== 'undefined' && !window.baseURL) {
    window.baseURL = '/api';
  }
  axios.defaults.adapter = createMockAdapter(fixtures, { latency: 120 });
  // eslint-disable-next-line no-console
  console.info(
    '%c[PCM DEMO] Mock API enabled — running on captured fixtures, no backend required.',
    'color:#22c55e;font-weight:bold;'
  );
  return true;
}
