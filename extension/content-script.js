/**
 * OptionLens Content Script
 */

let overlayButton = null;

function detectBroker() {
  if (window.FidelityParser && window.FidelityParser.detect()) return window.FidelityParser;
  if (window.RobinhoodParser && window.RobinhoodParser.detect()) return window.RobinhoodParser;
  if (window.WebullParser && window.WebullParser.detect()) return window.WebullParser;
  if (window.YahooParser && window.YahooParser.detect()) return window.YahooParser;
  return null;
}

function runExtraction() {
  const parser = detectBroker();
  if (!parser) return null;

  try {
    const rawData = parser.parse();
    // Build and normalize the payload
    return OptionLensCommon.buildPayload(
      rawData.broker,
      rawData.symbol,
      rawData.strategy,
      rawData.underlying_price,
      rawData.strike,
      rawData.premium,
      rawData.contracts,
      rawData.expiration,
      rawData.shares_covered,
      rawData.url
    );
  } catch (e) {
    console.error('[OptionLens] Extraction error:', e);
    return null;
  }
}

// Injects a floating action button on options-related pages
function injectTriggerButton() {
  const parser = detectBroker();
  if (!parser) return;

  // Simple throttle/check if we are on an options trading page
  // (Fidelity and Robinhood options trade urls often contain stock/option indicators)
  const isOptionsPage = window.location.href.includes('options') || 
                        window.location.href.includes('trade') ||
                        window.location.href.includes('options-chain');
  
  if (!isOptionsPage) return;
  if (document.getElementById('optionlens-floating-trigger')) return;

  // Create styling
  const style = document.createElement('style');
  style.id = 'optionlens-styles';
  style.textContent = `
    #optionlens-floating-trigger {
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 50px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 14px;
      font-weight: 600;
      border: none;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    #optionlens-floating-trigger:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.4);
      background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
    }
    #optionlens-floating-trigger:active {
      transform: translateY(1px);
    }
    #optionlens-floating-trigger svg {
      width: 16px;
      height: 16px;
      fill: currentColor;
    }
  `;
  document.head.appendChild(style);

  // Create button
  const btn = document.createElement('button');
  btn.id = 'optionlens-floating-trigger';
  btn.innerHTML = `
    <svg viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
    </svg>
    Analyze with OptionLens
  `;

  btn.addEventListener('click', () => {
    const payload = runExtraction();
    chrome.runtime.sendMessage({
      type: 'OPEN_SIDEPANEL_WITH_DATA',
      data: payload
    });
  });

  document.body.appendChild(btn);
  overlayButton = btn;
}

// Listen for messages from popup, service worker, or sidepanel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE_DATA') {
    const payload = runExtraction();
    sendResponse({ success: !!payload, data: payload });
  }
  return true;
});

function autoExtractAndNotify() {
  const payload = runExtraction();
  if (payload && payload.symbol) {
    chrome.runtime.sendMessage({
      type: 'AUTO_EXTRACTED_DATA',
      data: payload
    });
  }
}

// Run check on load
if (document.readyState === 'complete') {
  injectTriggerButton();
  autoExtractAndNotify();
} else {
  window.addEventListener('load', () => {
    injectTriggerButton();
    autoExtractAndNotify();
  });
}

// Observe URL changes (common in SPA websites like Robinhood)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(() => {
      injectTriggerButton();
      autoExtractAndNotify();
    }, 2000); // Wait for SPA DOM render
  }
}).observe(document, { subtree: true, childList: true });
