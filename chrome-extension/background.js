// Import environmental config setup
importScripts('config.js');
const API_BASE_URL = self.API_BASE_URL || 'http://localhost:5000';

/**
 * Listens for keyboard commands configured in manifest.json.
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'push-current-tab') {
    console.log('[QuickPipe Service Worker] Triggered command: push-current-tab');
    
    try {
      // 1. Retrieve the registered syncKey from chrome storage
      const storage = await chrome.storage.local.get('syncKey');
      const syncKey = storage.syncKey;

      if (!syncKey) {
        console.warn('[QuickPipe] Cannot push link: No syncKey is registered. Please configure the extension first.');
        return;
      }

      // 2. Query the current active browser tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];

      if (!activeTab || !activeTab.url) {
        console.warn('[QuickPipe] Cannot push link: No active tab or valid URL detected.');
        return;
      }

      const content = activeTab.url;
      console.log(`[QuickPipe] Preparing to push URL: ${content}`);

      // 3. Dispatch the push request to the central API
      const response = await fetch(`${API_BASE_URL}/api/links/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          syncKey,
          content,
          sourceDevice: 'desktop'
        })
      });

      if (response.ok) {
        const payload = await response.json();
        console.log('[QuickPipe] Tab synced successfully:', payload.message);
      } else {
        const errorData = await response.json();
        console.error('[QuickPipe] Push failed with server error:', errorData.error);
      }
    } catch (error) {
      console.error('[QuickPipe] Push failed due to network or local storage error:', error);
    }
  }
});
