import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SectionList,
  Linking,
  Clipboard,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
  ScrollView,
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { deleteSecureKey } from '../utils/secureStore';
import { getOrCreateMobileDeviceId, getMobileDeviceName } from '../utils/deviceInfo';
import CONFIG from '../config';

const API_BASE_URL = CONFIG.API_BASE_URL;

const groupLinksByDate = (linksList) => {
  const groups = {};
  const todayStr = new Date().toDateString();
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  linksList.forEach((link) => {
    const date = new Date(link.createdAt);
    const dateStr = date.toDateString();
    let title = '';

    if (dateStr === todayStr) {
      title = 'Today';
    } else if (dateStr === yesterdayStr) {
      title = 'Yesterday';
    } else {
      title = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(link);
  });

  return Object.keys(groups).map((title) => ({
    title,
    data: groups[title]
  }));
};

export default function HomeDashboard({ syncKey, onLogout }) {
  const [links, setLinks] = useState([]);
  const [devices, setDevices] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentView, setCurrentView] = useState('feed'); // 'feed' | 'manage'
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const sections = useMemo(() => groupLinksByDate(links), [links]);

  /**
   * Fetches link history from backend with optional search filter.
   */
  const fetchHistory = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const deviceId = await getOrCreateMobileDeviceId();
      const deviceName = getMobileDeviceName();
      
      let url = `${API_BASE_URL}/api/links/history?syncKey=${syncKey}&deviceId=${deviceId}&deviceName=${encodeURIComponent(deviceName)}&deviceType=mobile`;
      if (query.trim()) {
        url += `&search=${encodeURIComponent(query.trim())}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (response.ok) {
        setLinks(data.links || []);
        setDevices(data.devices || []);
      } else {
        console.warn('[QuickPipe] Server error fetching history:', data.error);
      }
    } catch (error) {
      console.error('[QuickPipe] Network error fetching history:', error);
    } finally {
      setLoading(false);
    }
  }, [syncKey]);

  // Load history on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Search input debouncer
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchHistory]);

  /**
   * Pull-to-refresh handler
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHistory(searchQuery);
    setRefreshing(false);
  };

  /**
   * Copies syncKey to device clipboard
   */
  const copySyncKeyToClipboard = () => {
    Clipboard.setString(syncKey);
    triggerFeedbackToast('syncKey copied! ');
  };

  /**
   * Interactive list-item tap handler
   * - URLs: Launch native web browser
   * - Texts: Copy text to clipboard
   */
  const handleItemPress = (content) => {
    const isUrl = content.startsWith('http://') || content.startsWith('https://');

    if (isUrl) {
      if (Platform.OS === 'web') {
        window.open(content, '_blank');
        triggerFeedbackToast('Opening link... ');
      } else {
        Linking.canOpenURL(content)
          .then((supported) => {
            if (supported) {
              Linking.openURL(content);
            } else {
              Clipboard.setString(content);
              triggerFeedbackToast('Copied URL (Browser unsupported)');
            }
          })
          .catch((err) => console.error('Error launching link:', err));
      }
    } else {
      Clipboard.setString(content);
      triggerFeedbackToast('Text copied to clipboard! ');
    }
  };

  /**
   * Unlinks the current client device
   */
  const handleLogoutPress = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to disconnect this device? Your data will remain synced in the cloud.')) {
        deleteSecureKey().then(() => onLogout());
      }
    } else {
      Alert.alert(
        'Unlink Device',
        'Are you sure you want to disconnect this device? Your data will remain synced in the cloud.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Unlink', 
            style: 'destructive', 
            onPress: async () => {
              await deleteSecureKey();
              onLogout();
            } 
          }
        ]
      );
    }
  };

  /**
   * Deletes an item from the history.
   */
  const handleDeleteItem = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/links/${id}?syncKey=${syncKey}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (response.ok) {
        triggerFeedbackToast('Snippet deleted');
        fetchHistory(searchQuery);
      } else {
        console.warn('Failed to delete item:', data.error);
        triggerFeedbackToast('Delete failed ');
      }
    } catch (err) {
      console.error(err);
      triggerFeedbackToast('Delete failed ');
    }
  };

  const confirmDelete = (id) => {
    if (Platform.OS === 'web') {
      if (confirm('Delete this item from your pipeline?')) {
        handleDeleteItem(id);
      }
    } else {
      Alert.alert(
        'Delete Item',
        'Delete this item from your pipeline?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteItem(id) }
        ]
      );
    }
  };

  /**
   * Shows a brief local feedback toast
   */
  const triggerFeedbackToast = (msg) => {
    setFeedbackMsg(msg);
    setTimeout(() => {
      setFeedbackMsg('');
    }, 2000);
  };

  // Render helper for single items
  const renderItem = ({ item }) => {
    const isUrl = item.content.startsWith('http://') || item.content.startsWith('https://');
    let displayTitle = item.content;

    if (isUrl) {
      try {
        const urlObj = new URL(item.content);
        displayTitle = urlObj.hostname;
      } catch (e) {
        // Fallback to text
      }
    }

    return (
      <TouchableOpacity
        className="bg-cardglass rounded-2xl p-4 mb-3 border border-slate-800/80 flex-row justify-between items-center active:bg-slate-800/40"
        activeOpacity={0.7}
        onPress={() => handleItemPress(item.content)}
      >
        <View className="flex-1 mr-4">
          {isUrl ? (
            <View>
              <Text className="text-sm font-bold text-white mb-0.5">{displayTitle}</Text>
              <Text className="text-xs text-cyanaccent font-medium" numberOfLines={1}>{item.content}</Text>
            </View>
          ) : (
            <Text className="text-sm text-slate-200 leading-normal" numberOfLines={3}>{item.content}</Text>
          )}

          {/* Card metadata (device & time) */}
          <View className="flex-row items-center mt-2.5">
            <View className="bg-slate-950/60 border border-slate-600 rounded px-1.5 py-0.5 mr-2">
              <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                {item.sourceDevice}
              </Text>
            </View>
            <Text className="text-[10px] text-slate-400">
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
        
        <View className="flex-row items-center">
          <TouchableOpacity 
            className="p-2.5 bg-slate-950/60 border border-slate-900 rounded-xl active:bg-slate-900 mr-2"
            onPress={() => {
              Clipboard.setString(item.content);
              triggerFeedbackToast('Copied to clipboard!');
            }}
          >
            <Feather name="copy" size={16} color="#00F2FE" />
          </TouchableOpacity>
          <TouchableOpacity 
            className="p-2.5 bg-red-950/20 border border-red-950/40 rounded-xl active:bg-red-950/40"
            onPress={() => confirmDelete(item.id)}
          >
            <Feather name="trash-2" size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-darkspace mt-10">
      {currentView === 'feed' ? (
        <>
          {/* Top Navigation */}
          <View className="flex-row justify-between items-center px-4 py-4 border-b border-slate-900 bg-darkspace">
            <View className="flex-row items-center">
              <Text className="text-2xl font-bold text-white tracking-tight">QuickPipe</Text>
              {/* <View className="w-1.5 h-1.5 rounded-full bg-cyanaccent ml-1" /> */}
            </View>
            <TouchableOpacity 
              className="px-3 py-1.5 bg-slate-950/60 border border-slate-800/80 rounded-xl active:bg-slate-900 flex-row items-center" 
              onPress={() => setCurrentView('manage')}
            >
              <Feather name="settings" size={12} color="#00F2FE" className="mr-1" />
              <Text className="text-xs text-slate-200 font-semibold">Manage</Text>
            </TouchableOpacity>
          </View>

          {/* Search Input Bar */}
          <View className="flex-row items-center mx-4 mt-4 mb-3 px-3 bg-slate-950/60 border border-slate-600 rounded-xl h-11 focus:border-cyanaccent">
            <Feather name="search" size={14} color="#64748B" />
            <TextInput
              className="flex-1 h-full text-sm text-white ml-2 bg-transparent"
              placeholder="Search feed..."
              placeholderTextColor="#838d9c"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          {/* History List Feed */}
          <View className="flex-1">
            {loading && links.length === 0 ? (
              <ActivityIndicator size="large" color="#00F2FE" className="mt-10" />
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                renderSectionHeader={({ section: { title } }) => (
                  <View className="py-2 items-center">
                    <View className="bg-slate-900 border border-slate-800/60 rounded-full px-3 py-0.5">
                      <Text className="text-[10px] font-bold text-slatemuted uppercase tracking-wide">
                        {title}
                      </Text>
                    </View>
                  </View>
                )}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                ListEmptyComponent={
                  <View className="items-center justify-center py-16 px-6">
                    <View className="p-4 bg-slate-950/60 border border-slate-900 rounded-full mb-3">
                      <Feather name="folder" size={32} color="#64748B" />
                    </View>
                    <Text className="text-base font-bold text-white mb-1">Feed Empty</Text>
                    <Text className="text-xs text-slatemuted text-center leading-normal max-w-[240px]">
                      Links pushed from other devices will display here.
                    </Text>
                    
                    <TouchableOpacity
                      onPress={() => Linking.openURL('https://github.com/experimenthim0/quickpipe')}
                      className="py-2.5 px-5 bg-slate-950/60 border border-cyanaccent/30 rounded-xl items-center active:bg-slate-900 mb-3 flex-row justify-center"
                    >
                      <Feather name="chrome" size={14} color="#00F2FE" />
                      <Text className="text-cyanaccent text-xs font-bold ml-2">Get Chrome Extension from GitHub</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => Linking.openURL('https://github.com/experimenthim0/quickpipe')}
                      className="py-2.5 px-5 bg-slate-950/60 border border-slate-800 rounded-xl items-center active:bg-slate-900 flex-row justify-center"
                    >
                      <Feather name="github" size={14} color="#64748b" />
                      <Text className="text-slate-300 text-xs font-semibold ml-2">View Source Code on GitHub</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            )}
          </View>
        </>
      ) : (
        <>
          {/* Manage View Header */}
          <View className="flex-row items-center px-4 py-4 border-b border-slate-900 bg-darkspace">
            <TouchableOpacity 
              className="p-2 bg-slate-950/60 border border-slate-800 rounded-xl active:bg-slate-900 mr-3" 
              onPress={() => setCurrentView('feed')}
            >
              <Feather name="arrow-left" size={20} color="#00F2FE" />
            </TouchableOpacity>
            <Text className="text-2xl font-bold text-white tracking-tight">Manage Pipeline</Text>
          </View>

          {/* Manage Options Scroll */}
          <ScrollView 
            className="flex-1"
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            {/* SyncKey dashboard card */}
            <TouchableOpacity 
              className="p-4 bg-cardglass border border-slate-800 rounded-2xl flex-row justify-between items-center active:opacity-95" 
              activeOpacity={0.8}
              onPress={copySyncKeyToClipboard}
            >
              <View>
                <Text className="text-[10px] text-slatemuted font-bold uppercase tracking-wider">Permanent syncKey</Text>
                <Text className="text-lg font-bold text-cyanaccent mt-1 font-mono">{syncKey}</Text>
              </View>
              <View className="p-2 bg-slate-950/60 border border-slate-800 rounded-xl">
                <Feather name="copy" size={18} color="#00F2FE" />
              </View>
            </TouchableOpacity>

            {/* Connected devices list */}
            <View className="mt-6">
              <Text className="text-xs font-bold text-slatemuted uppercase tracking-wider mb-3">
                Connected Devices ({devices.length})
              </Text>
              {devices.map((d) => (
                <View 
                  key={d.deviceId} 
                  className="bg-cardglass border border-slate-800/80 rounded-xl p-3.5 mb-2.5 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center">
                    <View className="p-2 bg-slate-950/60 border border-slate-900 rounded-xl mr-3">
                      <Feather 
                        name={d.deviceType === 'desktop' ? 'monitor' : 'smartphone'} 
                        size={16} 
                        color="#00F2FE" 
                      />
                    </View>
                    <View>
                      <Text className="text-sm font-semibold text-slate-200">{d.deviceName}</Text>
                      <Text className="text-[10px] text-slate-500 mt-0.5">
                        Active {new Date(d.lastActiveAt).toLocaleDateString()} at {new Date(d.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-emerald-950/40 rounded-full px-2 py-0.5 border border-emerald-800/40">
                    <Text className="text-[8px] text-emerald-400 font-bold uppercase tracking-wide">Active</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Disconnect action */}
            <TouchableOpacity 
              className="mt-8  h-12 border border-red-700 bg-red-950/10 rounded-xl justify-center items-center active:bg-red-950/20"
              onPress={handleLogoutPress}
            >
              <View className="flex-row items-center">
                <Feather name="log-out" size={16} color="#ef4444" className="mr-1.5" />
                <Text className="text-red-400 text-sm font-semibold">Disconnect Device</Text>
              </View>
            </TouchableOpacity>

            {/* About QuickPipe Section */}
            <View className="mt-8 mb-8 p-6 bg-cardglass border border-slate-800/80 rounded-3xl">
  {/* Header */}
  <View className="items-center mb-6">
    <View className="p-3 border border-slate-900 rounded-2xl mb-3">
      {/* <Feather name="send" size={24} color="#00F2FE" /> */}
      <Image
  source={{ uri: 'https://raw.githubusercontent.com/experimenthim0/quickpipe/main/chrome-extension/icon128.png' }}
  className="w-16 h-16 rounded-xl"
/>
    </View>
    <Text className="text-xl font-bold text-white tracking-tight">QuickPipe</Text>
    <Text className="text-[10px] font-bold text-slatemuted uppercase tracking-wider mt-1 bg-slate-900 border border-slate-800/60 rounded-full px-2.5 py-0.5">
      v1.0.0 • Open Source
    </Text>
    <Text className="text-xs text-cyanaccent italic mt-2.5 text-center px-4">
      "The fastest pipeline for your links and text."
    </Text>
  </View>

  <View className="h-[1px] bg-slate-800/40 my-5" />

  {/* Mission */}
  <View>
    <View className="flex-row items-center mb-2.5">
      <Feather name="compass" size={14} color="#00F2FE" />
      <Text className="text-sm font-bold text-cyanaccent uppercase tracking-wider ml-2">The Mission</Text>
    </View>
    <Text className="text-sm text-slate-300 leading-relaxed">
      QuickPipe was born out of a simple, daily frustration: the annoying friction of messaging yourself on WhatsApp just to move a link or text snippet between your laptop and your phone.{"\n\n"}
      We stripped away the heavy bloat of traditional device sync tools to build a dedicated, lightning-fast data pipeline that protects your focus and logs your history in a clean, searchable feed.
    </Text>
  </View>

  <View className="h-[1px] bg-slate-800/40 my-5" />

  {/* Architecture */}
  <View>
    <View className="flex-row items-center mb-3">
      <Feather name="layers" size={14} color="#00F2FE" />
      <Text className="text-sm font-bold text-cyanaccent uppercase tracking-wider ml-2">Architecture</Text>
    </View>
    <View>
      <View className="flex-row items-center bg-slate-950/40 border border-slate-900/60 p-2.5 rounded-xl mb-2">
        <View className="w-1.5 h-1.5 rounded-full bg-cyanaccent mr-2.5" />
        <Text className="text-xs text-slate-200"><Text className="font-semibold text-white">Backend:</Text> Node.js, Express, MongoDB</Text>
      </View>
      <View className="flex-row items-center bg-slate-950/40 border border-slate-900/60 p-2.5 rounded-xl mb-2">
        <View className="w-1.5 h-1.5 rounded-full bg-cyanaccent mr-2.5" />
        <Text className="text-xs text-slate-200"><Text className="font-semibold text-white">Mobile App:</Text> React Native (Android 16 UI)</Text>
      </View>
      <View className="flex-row items-center bg-slate-950/40 border border-slate-900/60 p-2.5 rounded-xl">
        <View className="w-1.5 h-1.5 rounded-full bg-cyanaccent mr-2.5" />
        <Text className="text-xs text-slate-200"><Text className="font-semibold text-white">Desktop:</Text> Chrome Extension (MV3 Service)</Text>
      </View>
    </View>
  </View>

  <View className="h-[1px] bg-slate-800/40 my-5" />

  {/* Developer */}
  <View>
    <View className="flex-row items-center mb-2.5">
      <Feather name="code" size={14} color="#00F2FE" />
      <Text className="text-sm font-bold text-cyanaccent uppercase tracking-wider ml-2">Developed By</Text>
    </View>
    <View className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl">
      <Text className="text-md font-bold text-white">Nikhil Yadav</Text>
      <Text className="text-sm text-slate-400 italic mt-3 border-l-2 border-slate-800 pl-2.5">
        "Building tools at the intersection of infrastructure, automation, and clean code."
      </Text>
      <TouchableOpacity
        onPress={() => Linking.openURL('https://nikhim.me')}
        className="flex-row items-center mt-3"
      >
        <Feather name="globe" size={12} color="#00F2FE" />
        <Text className="text-xs text-cyanaccent font-semibold ml-1.5">nikhim.me</Text>
        <Feather name="arrow-up-right" size={11} color="#00F2FE" style={{ marginLeft: 2 }} />
      </TouchableOpacity>
    </View>
  </View>

  <View className="h-[1px] bg-slate-800/40 my-5" />

  {/* Open Source */}
  <View>
    <View className="flex-row items-center mb-2.5">
      <Feather name="users" size={14} color="#00F2FE" />
      <Text className="text-sm font-bold text-cyanaccent uppercase tracking-wider ml-2">Open Source Community</Text>
    </View>
    <Text className="text-sm text-slate-300 leading-relaxed mb-4">
      QuickPipe is completely open source and built for the developer community. Want to host your own backend, add a new browser port, or contribute a feature?
    </Text>

    <TouchableOpacity
      onPress={() => Linking.openURL('https://chromewebstore.google.com/')}
      className="py-3 bg-slate-950/60 border border-cyanaccent/30 rounded-xl items-center active:bg-slate-900 mb-2 flex-row justify-center"
    >
      <Feather name="chrome" size={14} color="#00F2FE" />
      <Text className="text-cyanaccent text-xs font-bold ml-2">Download Chrome Extension</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={() => Linking.openURL('https://github.com/experimenthim0/quickpipe/releases')}
      className="py-3 bg-slate-950/60 border border-slate-800 rounded-xl items-center active:bg-slate-900 mb-2 flex-row justify-center"
    >
      <Feather name="download" size={14} color="#00F2FE" />
      <Text className="text-cyanaccent text-xs font-bold ml-2">Download Extension (GitHub)</Text>
    </TouchableOpacity>

    <TouchableOpacity
      onPress={() => Linking.openURL('https://github.com/experimenthim0/quickpipe')}
      className="py-3 bg-slate-950/60 border border-slate-800 rounded-xl items-center active:bg-slate-900 mb-2 flex-row justify-center"
    >
      <Feather name="github" size={14} color="#00F2FE" />
      <Text className="text-cyanaccent text-xs font-bold ml-2">View Repository on GitHub</Text>
    </TouchableOpacity>
    <TouchableOpacity
      onPress={() => Linking.openURL('https://github.com/experimenthim0/quickpipe/issues')}
      className="py-3 bg-slate-950/60 border border-slate-800 rounded-xl items-center active:bg-slate-900 flex-row justify-center"
    >
      <Feather name="alert-circle" size={14} color="#00F2FE" />
      <Text className="text-cyanaccent text-xs font-bold ml-2">Report Issue / Request Feature</Text>
    </TouchableOpacity>
  </View>

  <View className="h-[1px] bg-slate-800/40 my-5" />

  {/* Support Me */}
  <View>
    <View className="flex-row items-center mb-2.5">
      <Feather name="coffee" size={14} color="#00F2FE" />
      <Text className="text-sm font-bold text-cyanaccent uppercase tracking-wider ml-2">Support This Project</Text>
    </View>
    <Text className="text-sm text-slate-300 leading-relaxed mb-4">
      QuickPipe is completely free. If you find it useful, please consider supporting the project to help cover backend server costs and future development!
    </Text>
    <TouchableOpacity
      onPress={() => Linking.openURL('https://nikhim.me/supportme')}
      className="py-3 bg-emerald-950/20 border border-emerald-900/60 rounded-xl items-center active:bg-emerald-900/40 flex-row justify-center"
    >
      <Feather name="heart" size={14} color="#34d399" />
      <Text className="text-emerald-400 text-md font-bold ml-2">Support Me</Text>
    </TouchableOpacity>
  </View>

  <View className="h-[1px] bg-slate-800/40 my-5" />

  {/* Footer */}
  <View className="items-center mt-2">
    <View className="flex-row items-center justify-center">
      <Feather name="heart" size={12} color="#ef4444" />
      <Text className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider ml-1.5">
        Made with love by NikHim
      </Text>
    </View>
  </View>
</View>
          </ScrollView>
        </>
      )}

      {/* Custom absolute feedback toast */}
      {feedbackMsg ? (
        <View className="absolute bottom-10 self-center bg-slate-950 border border-slate-800 rounded-full px-4 py-2.5">
          <Text className="text-cyanaccent text-xs font-semibold">{feedbackMsg}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
