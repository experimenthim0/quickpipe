import './global.css';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getSecureKey } from './utils/secureStore';
import Onboarding from './screens/Onboarding';
import HomeDashboard from './screens/HomeDashboard';

export default function App() {
  const [syncKey, setSyncKey] = useState(null);
  const [appReady, setAppReady] = useState(false);

  // Read secure syncKey on application load
  useEffect(() => {
    async function bootstrapApp() {
      try {
        const storedKey = await getSecureKey();
        if (storedKey) {
          setSyncKey(storedKey);
        }
      } catch (err) {
        console.error('[LinkSetu App] Failed bootstrapping storage:', err);
      } finally {
        setAppReady(true);
      }
    }

    bootstrapApp();
  }, []);

  if (!appReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00F2FE" />
      </View>
    );
  }

  return (
    <View style={styles.appContainer}>
      <StatusBar style="light" />
      {syncKey ? (
        // Load feed dashboard
        <HomeDashboard 
          syncKey={syncKey} 
          onLogout={() => setSyncKey(null)} 
        />
      ) : (
        // Load onboarding panel
        <Onboarding 
          onAuthSuccess={(key) => setSyncKey(key)} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#090D16', // Absolute deep-slate matte black
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090D16',
  }
});
