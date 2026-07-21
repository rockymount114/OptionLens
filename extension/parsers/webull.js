/**
 * Webull Option Parser
 */

const WebullParser = {
  detect() {
    return window.location.hostname.includes('webull.com');
  },

  parse() {
    const context = {
      broker: 'webull',
      symbol: null,
      strategy: null,
      underlying_price: null,
      strike: null,
      premium: null,
      contracts: null,
      expiration: null,
      shares_covered: 100,
      url: window.location.href
    };

    // --- 1. Symbol ---
    let symbolEl = document.querySelector('.ticker-name') || 
                   document.querySelector('.instrument-name') ||
                   document.querySelector('.quote-title h2');
    if (symbolEl) {
      context.symbol = symbolEl.textContent;
    }
    if (!context.symbol) {
      context.symbol = this.extractSymbolFromTitle(document.title);
    }

    // --- 2. Price ---
    let priceEl = null;
    try {
      const xpath = '//*[@id="DomWrap"]/div[2]/div[2]/div/div[1]';
      priceEl = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch (e) {
      console.warn('[OptionLens] Webull XPath lookup failed, falling back:', e);
    }
    if (!priceEl) {
      priceEl = document.querySelector('.ticker-price') || 
                document.querySelector('.quote-price') ||
                document.querySelector('.price-num');
    }
    if (priceEl) {
      context.underlying_price = OptionLensCommon.parseNumber(priceEl.textContent);
    }

    // --- 3. Option Ticket ---
    const contractsInput = document.querySelector('input.quantity-input') || 
                           document.querySelector('input[placeholder="Qty"]') ||
                           document.querySelector('.order-qty input');
    if (contractsInput) {
      context.contracts = OptionLensCommon.parseIntVal(contractsInput.value);
    }

    const premiumInput = document.querySelector('input.price-input') ||
                         document.querySelector('input[placeholder="Price"]') ||
                         document.querySelector('.order-price input');
    if (premiumInput) {
      context.premium = OptionLensCommon.parseNumber(premiumInput.value);
    }

    // Webull lists selected options in the row. Let's grab strike/expiration from selected rows
    const selectedRows = document.querySelectorAll('.selected-row, .active-row');
    if (selectedRows.length > 0) {
      const row = selectedRows[0];
      const strikeEl = row.querySelector('.strike-price') || row.querySelector('.strike');
      if (strikeEl) {
        context.strike = OptionLensCommon.parseNumber(strikeEl.textContent);
      }
      const expEl = row.querySelector('.expiration') || row.querySelector('.date');
      if (expEl) {
        context.expiration = OptionLensCommon.normalizeDate(expEl.textContent);
      }
    }

    // Clean up symbol
    if (context.symbol) {
      context.symbol = context.symbol.trim().toUpperCase().replace(/[^A-Z]/g, '');
    }

    return context;
  },

  extractSymbolFromTitle(title) {
    if (!title) return null;
    const bracketMatch = title.match(/\(([A-Z]{1,5})\)/);
    if (bracketMatch) return bracketMatch[1];
    
    const startMatch = title.match(/^([A-Z]{1,5})\b/);
    if (startMatch) return startMatch[1];
    
    const words = title.split(/[\s,.\-|/()]+/);
    for (const w of words) {
      if (/^[A-Z]{1,5}$/.test(w) && !['STOCK', 'PRICE', 'WEBULL', 'NYSE', 'NASDAQ', 'QUOTE', 'NEWS', 'PORTFOLIO'].includes(w)) {
        return w;
      }
    }
    return null;
  }
};

window.WebullParser = WebullParser;
