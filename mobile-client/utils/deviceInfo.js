import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Retrieves or generates a unique stable device ID for this client.
 */
export async function getOrCreateMobileDeviceId() {
  try {
    if (Platform.OS === 'web') {
      let id = localStorage.getItem('QUICKPIPE_DEVICE_ID');
      if (!id) {
        id = 'mobile_web_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('QUICKPIPE_DEVICE_ID', id);
      }
      return id;
    } else {
      let id = await SecureStore.getItemAsync('QUICKPIPE_DEVICE_ID');
      if (!id) {
        id = 'mobile_native_' + Math.random().toString(36).substring(2, 15);
        await SecureStore.setItemAsync('QUICKPIPE_DEVICE_ID', id);
      }
      return id;
    }
  } catch (error) {
    console.error('[QuickPipe DeviceInfo] Failed to retrieve/save deviceId:', error);
    return 'mobile_fallback_' + Math.random().toString(36).substring(2, 8);
  }
}

/**
 * Returns a descriptive name for the active device.
 */
export function getMobileDeviceName() {
  if (Platform.OS === 'web') {
    const ua = navigator.userAgent;
    let browser = 'Browser';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    
    let os = 'Web';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';
    
    return `${browser} on ${os}`;
  } else {
    return Platform.OS === 'ios' ? 'iPhone App' : 'Android App';
  }
}
