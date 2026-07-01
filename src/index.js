import './index.css';
import {createRoot} from 'react-dom/client';
import App from './App';
import ContextProvider from './context/ContextProvider';
import { installMockAdapter } from './mocks/install';

// In demo mode (REACT_APP_DEMO_MODE=mock) route all axios traffic through the
// captured-fixture adapter so the app runs with no backend. No-op otherwise.
installMockAdapter();

createRoot(document.getElementById('root')).render(
<ContextProvider>
    <App />
</ContextProvider>);