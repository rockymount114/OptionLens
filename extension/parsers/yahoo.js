/**
 * Yahoo Finance Option Parser
 */

const YahooParser = {
  detect() {
    return window.location.hostname.includes('yahoo.com');
  },

  parse() {
    const context = {
      broker: 'yahoo',
      symbol: null,
      strategy: null,
      underlying_price: null,
      strike: null,
      premium: null,
      contracts: 1,
      expiration: null,
      shares_covered: 100,
      url: window.location.href
    };

    // --- 1. Symbol from Pathname ---
    // URL: https://finance.yahoo.com/quote/AAPL/options
    const parts = window.location.pathname.split('/');
    const quoteIdx = parts.indexOf('quote');
    if (quoteIdx !== -1 && parts[quoteIdx + 1]) {
      context.symbol = parts[quoteIdx + 1].toUpperCase();
    }

    // --- 2. Underlying Price ---
    const priceEl = document.querySelector('[data-field="regularMarketPrice"]') || 
                    document.querySelector('.Fz\\(36px\\)') || 
                    document.querySelector('fin-streamer[data-field="regularMarketPrice"]');
    if (priceEl) {
      context.underlying_price = OptionLensCommon.parseNumber(priceEl.textContent);
    }

    // --- 3. Option parameters from Selected/Active rows ---
    // Yahoo lists contracts in table. We can grab parameters from selected rows
    const selectedRows = document.querySelectorAll('tr.selected, tr.active, tr.highlighted');
    if (selectedRows.length > 0) {
      const row = selectedRows[0];
      
      // Strike is usually in a link under class containing 'strike' or column 3
      const strikeEl = row.querySelector('.C\\($linkActiveColor\\)') || row.querySelector('td:nth-child(3)');
      if (strikeEl) {
        context.strike = OptionLensCommon.parseNumber(strikeEl.textContent);
      }

      // Last price/Premium is usually column 4 or containing 'lastPrice'
      const premiumEl = row.querySelector('td:nth-child(4)');
      if (premiumEl) {
        context.premium = OptionLensCommon.parseNumber(premiumEl.textContent);
      }
    }

    // Expiration date from selected dropdown in Yahoo
    const expSelect = document.querySelector('select.options-expiration') || 
                      document.querySelector('[data-testid="options-expiration"]') || 
                      document.querySelector('select');
    if (expSelect) {
      context.expiration = OptionLensCommon.normalizeDate(expSelect.value || expSelect.textContent);
    }

    // Defaults / standard calculations
    context.strategy = 'covered_call'; // default guess
    return context;
  }
};

window.YahooParser = YahooParser;
