import { Platform, NativeModules } from 'react-native';

// Dynamically extract the Metro bundler's host IP address in development mode.
// This allows the physical device or simulator to automatically connect to the local API server.
const getDevServerIp = () => {
  const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
  const match = scriptURL.match(/^https?:\/\/([^:/]+)(:\d+)?/);
  return match ? match[1] : null;
};

const devIp = getDevServerIp();

// Fallback to the developer's computer local network IP (10.235.234.110)
// if the dynamic detection fails or returns a loopback address.
const hostIp = devIp && !devIp.includes('localhost') && !devIp.includes('127.0.0.1')
  ? devIp
  : '10.235.234.110';

const CONFIG = {
  // Target API base address for the Express server (port 5000)
  API_BASE_URL: `http://${hostIp}:5000`
};

console.log('[QuickPipe] API Base URL configured to:', CONFIG.API_BASE_URL);

export default CONFIG;

