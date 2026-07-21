/**
 * OptionLens Service Worker (Background Script)
 */

const API_BASE_URL = 'http://localhost:5000/api';

// On installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[OptionLens] Service worker installed.');
  // Configure sidepanel behavior if API exists
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
});

// Helper to make API requests with Bearer JWT token
async function apiRequest(endpoint, method = 'GET', body = null) {
  const { auth_token } = await chrome.storage.local.get('auth_token');
  
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (auth_token) {
    headers['Authorization'] = `Bearer ${auth_token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await res.json();
    return { status: res.status, data };
  } catch (error) {
    console.error(`[OptionLens] API Error on ${endpoint}:`, error);
    return { status: 500, error: 'Network error or backend offline.' };
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_SIDEPANEL_WITH_DATA') {
    // Save data locally so side panel can access it
    chrome.storage.local.set({ latest_extracted_data: message.data }, () => {
      if (chrome.sidePanel && sender.tab) {
        chrome.sidePanel.open({ tabId: sender.tab.id })
          .then(() => {
            // Send message to sidepanel indicating data is updated
            chrome.runtime.sendMessage({ type: 'DATA_UPDATED', data: message.data }, () => {
              if (chrome.runtime.lastError) {
                // Silently ignore connection warnings: sidepanel pulls initial data from storage on startup anyway
                console.log('[OptionLens] Sidepanel initialization in progress, connection warning safely ignored.');
              }
            });
          })
          .catch((err) => console.error('[OptionLens] Error opening sidepanel:', err));
      }
    });
    sendResponse({ success: true });
  }

  else if (message.type === 'AUTO_EXTRACTED_DATA') {
    chrome.storage.local.set({ latest_extracted_data: message.data }, () => {
      chrome.runtime.sendMessage({ type: 'DATA_UPDATED', data: message.data }, () => {
        if (chrome.runtime.lastError) {
          // Ignore connection warnings when side panel is closed
        }
      });
    });
    sendResponse({ success: true });
  }

  else if (message.type === 'FETCH_YAHOO_FUNDAMENTALS') {
    const modules = 'quoteType,defaultKeyStatistics,financialData,recommendationTrend,assetProfile,summaryDetail';
    fetch(`https://query1.finance.yahoo.com/v10/finance/quoteSummary/${message.symbol}?modules=${modules}`)
      .then(res => {
        if (!res.ok) throw new Error('Yahoo API HTTP error: ' + res.status);
        return res.json();
      })
      .then(data => {
        const result = data.quoteSummary && data.quoteSummary.result ? data.quoteSummary.result[0] : null;
        sendResponse({ success: true, data: result });
      })
      .catch(err => {
        console.error('[OptionLens] Error fetching Yahoo Finance fundamentals:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open for async response
  }

  else if (message.type === 'API_REQUEST') {
    apiRequest(message.endpoint, message.method, message.body)
      .then(response => sendResponse(response));
    return true; // Keep channel open for async response
  }

  else if (message.type === 'GET_AUTH_STATE') {
    chrome.storage.local.get(['auth_token', 'user_email'], (result) => {
      sendResponse({ loggedIn: !!result.auth_token, email: result.user_email });
    });
    return true;
  }

  else if (message.type === 'SET_AUTH_STATE') {
    chrome.storage.local.set({ 
      auth_token: message.token, 
      user_email: message.email 
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  else if (message.type === 'CLEAR_AUTH_STATE') {
    chrome.storage.local.remove(['auth_token', 'user_email'], () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  return true;
});
