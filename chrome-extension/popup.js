// Load configuration base API endpoint
const API_BASE_URL = self.API_BASE_URL || 'http://localhost:5000';

// Helper to retrieve or generate unique deviceId for this extension instance
async function getOrCreateDeviceId() {
  const data = await chrome.storage.local.get('deviceId');
  if (data.deviceId) {
    return data.deviceId;
  }
  const newId = 'chrome_' + Math.random().toString(36).substring(2, 15);
  await chrome.storage.local.set({ deviceId: newId });
  return newId;
}

// Try to get Chrome Profile user info (Google Email) as the device name
async function getDeviceName() {
  return new Promise((resolve) => {
    try {
      chrome.identity.getProfileUserInfo({ privilege: 'cached' }, (userInfo) => {
        if (userInfo && userInfo.email) {
          resolve(`Chrome (${userInfo.email})`);
        } else {
          resolve(getDefaultDeviceName());
        }
      });
    } catch (e) {
      resolve(getDefaultDeviceName());
    }
  });
}

function getDefaultDeviceName() {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  
  return `Chrome on ${os}`;
}

// DOM Element Declarations
const onboardingView = document.getElementById('onboarding-view');
const dashboardView = document.getElementById('dashboard-view');
const aboutView = document.getElementById('about-view');
const onboardingForm = document.getElementById('onboarding-form');
const syncKeyInput = document.getElementById('sync-key-input');
const displaySyncKey = document.getElementById('display-sync-key');
const logoutBtn = document.getElementById('logout-btn');
const infoBtn = document.getElementById('info-btn');
const aboutBackBtn = document.getElementById('about-back-btn');
const pushTabBtn = document.getElementById('push-tab-btn');
const searchInput = document.getElementById('search-input');
const historyList = document.getElementById('history-list');
const loadingSpinner = document.getElementById('loading-spinner');
const emptyState = document.getElementById('empty-state');
const copyToast = document.getElementById('copy-toast');

let cachedSyncKey = '';
let searchDebounceTimeout = null;
let currentActiveView = 'onboarding'; // 'onboarding' | 'dashboard' | 'about'
let previousView = 'onboarding';

// Initialize app on popup load
document.addEventListener('DOMContentLoaded', initializePopup);

/**
 * Bootstraps the popup UI by checking if a syncKey exists in local storage.
 */
async function initializePopup() {
  // Register About toggle listeners
  if (infoBtn) {
    infoBtn.addEventListener('click', () => {
      if (currentActiveView === 'about') {
        closeAboutView();
      } else {
        showAboutView();
      }
    });
  }
  if (aboutBackBtn) {
    aboutBackBtn.addEventListener('click', closeAboutView);
  }

  try {
    const data = await chrome.storage.local.get('syncKey');
    const syncKey = data.syncKey;

    if (syncKey) {
      cachedSyncKey = syncKey;
      showDashboardView(syncKey);
    } else {
      showOnboardingView();
    }
  } catch (error) {
    console.error('[QuickPipe] Failed to read initialization storage:', error);
    showOnboardingView();
  }
}

/**
 * Configures UI and triggers history download for logged-in states.
 * @param {string} syncKey - The user's pairing token.
 */
function showDashboardView(syncKey) {
  onboardingView.style.display = 'none';
  aboutView.style.display = 'none';
  dashboardView.style.display = 'flex';
  logoutBtn.style.display = 'flex';
  if (infoBtn) infoBtn.style.display = 'flex';
  const container = document.getElementById('header-sync-key-container');
  if (container) container.style.display = 'flex';
  
  displaySyncKey.textContent = syncKey;
  displaySyncKey.title = syncKey; // Tooltip support

  currentActiveView = 'dashboard';

  // Load latest feed
  fetchHistory();
}

/**
 * Prepares the onboarding panel.
 */
function showOnboardingView() {
  dashboardView.style.display = 'none';
  aboutView.style.display = 'none';
  onboardingView.style.display = 'flex';
  logoutBtn.style.display = 'none';
  if (infoBtn) infoBtn.style.display = 'flex';
  const container = document.getElementById('header-sync-key-container');
  if (container) container.style.display = 'none';
  syncKeyInput.value = '';

  currentActiveView = 'onboarding';
}

/**
 * Activates the About section overlay panel.
 */
function showAboutView() {
  previousView = currentActiveView;
  currentActiveView = 'about';

  onboardingView.style.display = 'none';
  dashboardView.style.display = 'none';
  aboutView.style.display = 'flex';

  logoutBtn.style.display = 'none';
  const container = document.getElementById('header-sync-key-container');
  if (container) container.style.display = 'none';
}

/**
 * Closes the About section and returns to the previous view context.
 */
function closeAboutView() {
  if (previousView === 'dashboard') {
    showDashboardView(cachedSyncKey);
  } else {
    showOnboardingView();
  }
}

// Onboarding submission handler
onboardingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const inputKey = syncKeyInput.value.trim();

  if (!inputKey) return;

  // Simple client-side format checks (SETU-XXXX-XXXX)
  if (!/^SETU-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(inputKey)) {
    alert('Invalid format. Key must look like: SETU-XXXX-XXXX');
    return;
  }

  const normalizedKey = inputKey.toUpperCase();

  // Validate key against server before saving to storage
  loadingSpinner.style.display = 'block';
  try {
    const response = await fetch(`${API_BASE_URL}/api/links/history?syncKey=${normalizedKey}`);
    if (response.ok) {
      // Save valid key
      await chrome.storage.local.set({ syncKey: normalizedKey });
      cachedSyncKey = normalizedKey;
      showDashboardView(normalizedKey);
    } else {
      const err = await response.json();
      alert(`Validation failed: ${err.error || 'Server error'}`);
    }
  } catch (error) {
    console.error('Validation fetch error:', error);
    alert('Unable to reach validation server. Please check connection and try again.');
  } finally {
    loadingSpinner.style.display = 'none';
  }
});

// Logout / Unlink Device action handler
logoutBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to unlink this device? Your history will remain in the cloud.')) {
    try {
      await chrome.storage.local.remove('syncKey');
      cachedSyncKey = '';
      showOnboardingView();
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
});

// Helper function to push any content to the server
async function pushContent(content) {
  try {
    const deviceId = await getOrCreateDeviceId();
    const deviceName = await getDeviceName();

    const response = await fetch(`${API_BASE_URL}/api/links/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        syncKey: cachedSyncKey,
        content: content,
        sourceDevice: 'desktop',
        deviceId,
        deviceName,
        deviceType: 'desktop'
      })
    });

    if (response.ok) {
      showToast('Pushed successfully! ⚡');
      fetchHistory(searchInput.value.trim());
      return true;
    } else {
      const err = await response.json();
      showToast(`Error: ${err.error}`);
      return false;
    }
  } catch (error) {
    console.error('Push error:', error);
    showToast('Failed to connect to API server.');
    return false;
  }
}

// Click header syncKey container to copy key
const headerSyncKeyContainer = document.getElementById('header-sync-key-container');
if (headerSyncKeyContainer) {
  headerSyncKeyContainer.addEventListener('click', () => {
    if (cachedSyncKey) {
      navigator.clipboard.writeText(cachedSyncKey)
        .then(() => showToast('syncKey copied! 📋'))
        .catch(err => console.error('Failed to copy syncKey:', err));
    }
  });
}

// Manual Push Current Tab Handler
pushTabBtn.addEventListener('click', async () => {
  pushTabBtn.disabled = true;
  const originalText = pushTabBtn.innerHTML;
  pushTabBtn.innerHTML = '<span>⏳</span> Syncing...';

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];

    if (!activeTab || !activeTab.url) {
      showToast('No active tab URL detected.');
      return;
    }

    await pushContent(activeTab.url);
  } catch (error) {
    console.error('Push tab error:', error);
    showToast('Failed to connect to API server.');
  } finally {
    pushTabBtn.disabled = false;
    pushTabBtn.innerHTML = originalText;
  }
});

// Paste & Push Button Handler
const pastePushBtn = document.getElementById('paste-push-btn');
if (pastePushBtn) {
  pastePushBtn.addEventListener('click', async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText || !clipboardText.trim()) {
        showToast('Clipboard is empty.');
        return;
      }
      await pushContent(clipboardText.trim());
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      showToast('Failed to read clipboard.');
    }
  });
}

// SearchInput enter-key handler for quick pushing
searchInput.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const val = searchInput.value.trim();
    if (!val) return;
    
    searchInput.disabled = true;
    const success = await pushContent(val);
    searchInput.disabled = false;
    if (success) {
      searchInput.value = '';
    }
    searchInput.focus();
  }
});

// Debounced history filtering inputs
searchInput.addEventListener('input', (e) => {
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout);
  }

  const query = e.target.value.trim();
  searchDebounceTimeout = setTimeout(() => {
    fetchHistory(query);
  }, 250);
});

/**
 * Downloads list items from API and structures history feed.
 * @param {string} [searchQuery=''] - Optional filter string.
 */
async function fetchHistory(searchQuery = '') {
  if (!cachedSyncKey) return;

  loadingSpinner.style.display = 'block';
  emptyState.style.display = 'none';

  try {
    const deviceId = await getOrCreateDeviceId();
    const deviceName = await getDeviceName();

    let url = `${API_BASE_URL}/api/links/history?syncKey=${cachedSyncKey}&deviceId=${deviceId}&deviceName=${encodeURIComponent(deviceName)}&deviceType=desktop`;
    if (searchQuery) {
      url += `&search=${encodeURIComponent(searchQuery)}`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404 || response.status === 401) {
        // Sync key was invalid or deleted from the backend. Force logout.
        console.warn('SyncKey is invalid or expired. Forcing logout.');
        await chrome.storage.local.remove('syncKey');
        cachedSyncKey = '';
        showOnboardingView();
        return;
      }
      throw new Error(`History download failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    renderHistoryItems(data.links);
  } catch (error) {
    console.error('Fetch history error:', error);
    historyList.innerHTML = `<li class="empty-state" style="flex-direction: column;"><span class="empty-icon">⚠️</span><span class="empty-text">Failed to sync feed.</span><span style="font-size:10px; color:var(--text-muted); margin-top:4px; text-align:center;">Check your connection or ensure the API server is running.</span></li>`;
  } finally {
    loadingSpinner.style.display = 'none';
  }
}

/**
 * Dynamically builds DOM items for link dashboard cards.
 * @param {Array} links - Array of link objects.
 */
function renderHistoryItems(links) {
  historyList.innerHTML = '';

  if (!links || links.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  const todayStr = new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  let lastHeader = '';

  links.forEach(link => {
    const date = new Date(link.createdAt);
    const dateStr = date.toDateString();
    let currentHeader = '';

    if (dateStr === todayStr) {
      currentHeader = 'Today';
    } else if (dateStr === yesterdayStr) {
      currentHeader = 'Yesterday';
    } else {
      currentHeader = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    if (currentHeader !== lastHeader) {
      lastHeader = currentHeader;
      const headerLi = document.createElement('li');
      headerLi.className = 'date-separator';
      headerLi.innerHTML = `<span>${currentHeader}</span>`;
      historyList.appendChild(headerLi);
    }

    const li = document.createElement('li');
    li.className = 'history-item';

    const isUrl = link.content.startsWith('http://') || link.content.startsWith('https://');

    // Create wrapper for description details
    const wrapper = document.createElement('div');
    wrapper.className = 'item-content-wrapper';

    if (isUrl) {
      const urlText = link.content;
      // Extract hostname for cleaner presentation
      let hostname = urlText;
      try {
        hostname = new URL(urlText).hostname;
      } catch (e) {
        // Fallback to text
      }

      wrapper.innerHTML = `
        <div class="item-title" title="${urlText}">${hostname}</div>
        <div class="item-url" title="${urlText}">${urlText}</div>
      `;
    } else {
      wrapper.innerHTML = `
        <div class="item-text-snippet" title="Click to Copy">${escapeHtml(link.content)}</div>
      `;
    }

    // Add source device, timestamp metadata
    const meta = document.createElement('div');
    meta.className = 'item-meta';
    
    const deviceBadge = document.createElement('span');
    deviceBadge.className = 'device-badge';
    deviceBadge.textContent = link.sourceDevice;
    
    const timestampStr = getRelativeTime(new Date(link.createdAt));
    const timeSpan = document.createElement('span');
    timeSpan.textContent = `• ${timestampStr}`;

    meta.appendChild(deviceBadge);
    meta.appendChild(timeSpan);
    wrapper.appendChild(meta);

    li.appendChild(wrapper);

    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete item';
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        <line x1="10" y1="11" x2="10" y2="17"></line>
        <line x1="14" y1="11" x2="14" y2="17"></line>
      </svg>
    `;
    
    // Delete click handler
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // prevent triggering parent card click
      if (confirm('Delete this item from your pipeline?')) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/links/${link.id}?syncKey=${cachedSyncKey}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            showToast('Item deleted successfully! 🗑️');
            fetchHistory(searchInput.value.trim());
          } else {
            const err = await response.json();
            showToast(`Delete failed: ${err.error}`);
          }
        } catch (err) {
          console.error(err);
          showToast('Failed to delete item.');
        }
      }
    });

    li.appendChild(deleteBtn);

    // Dynamic click handlers
    li.addEventListener('click', (e) => {
      // Ignore click if clicking the delete icon button specifically
      if (e.target.closest('.delete-btn')) return;

      if (isUrl) {
        // Extensions best practice: open new browser tabs
        chrome.tabs.create({ url: link.content });
      } else {
        // Text copy protocol
        navigator.clipboard.writeText(link.content)
          .then(() => showToast('Copied to clipboard! 📋'))
          .catch(err => console.error('Clipboard copy failed:', err));
      }
    });

    historyList.appendChild(li);
  });
}

/**
 * Formats timestamps relative to present moments.
 * @param {Date} date - The date to format.
 * @returns {string} Relative description (e.g., "Just now", "2m ago", "Yesterday").
 */
function getRelativeTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString();
}

/**
 * Triggers copy/action notification toasts.
 * @param {string} message - Toast message to show.
 */
function showToast(message) {
  copyToast.textContent = message;
  copyToast.classList.add('show');
  
  setTimeout(() => {
    copyToast.classList.remove('show');
  }, 2500);
}

/**
 * Helper to prevent HTML injections inside dashboard rendering.
 * @param {string} text - Raw content.
 * @returns {string} Escaped markup.
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
