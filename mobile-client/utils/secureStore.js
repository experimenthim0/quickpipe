import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Saves the user's secret syncKey in the device's secure hardware keychain.
 * Falls back to localStorage on Web.
 * 
 * @param {string} value - The syncKey string (SETU-XXXX-XXXX)
 * @returns {Promise<boolean>} Success indicator.
 */
export async function saveSecureKey(value) {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem('QUICKPIPE_SYNC_KEY', value);
      return true;
    }
    await SecureStore.setItemAsync('QUICKPIPE_SYNC_KEY', value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKEDThisDeviceOnly
    });
    return true;
  } catch (error) {
    console.error('[QuickPipe SecureStore] Failed to save key:', error);
    return false;
  }
}

/**
 * Retrieves the stored user syncKey from the device keychain.
 * Falls back to localStorage on Web.
 * 
 * @returns {Promise<string|null>} The syncKey if found, else null.
 */
export async function getSecureKey() {
  try {
    if (Platform.OS === 'web') {
      return localStorage.getItem('QUICKPIPE_SYNC_KEY');
    }
    const key = await SecureStore.getItemAsync('QUICKPIPE_SYNC_KEY');
    return key;
  } catch (error) {
    console.error('[QuickPipe SecureStore] Failed to retrieve key:', error);
    return null;
  }
}

/**
 * Deletes the syncKey, unlinking this client.
 * Falls back to localStorage on Web.
 * 
 * @returns {Promise<boolean>} Success indicator.
 */
export async function deleteSecureKey() {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem('QUICKPIPE_SYNC_KEY');
      return true;
    }
    await SecureStore.deleteItemAsync('QUICKPIPE_SYNC_KEY');
    return true;
  } catch (error) {
    console.error('[QuickPipe SecureStore] Failed to delete key:', error);
    return false;
  }
}
