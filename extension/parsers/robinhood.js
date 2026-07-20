/**
 * Robinhood Option Parser
 */

const RobinhoodParser = {
  detect() {
    return window.location.hostname.includes('robinhood.com');
  },

  parse() {
    const context = {
      broker: 'robinhood',
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

    // --- 1. Symbol from URL or page ---
    // URLs: https://robinhood.com/options/AAPL or https://robinhood.com/stocks/AAPL
    const urlParts = window.location.pathname.split('/');
    const optionsIdx = urlParts.indexOf('options');
    const stocksIdx = urlParts.indexOf('stocks');
    
    if (optionsIdx !== -1 && urlParts[optionsIdx + 1]) {
      context.symbol = urlParts[optionsIdx + 1];
    } else if (stocksIdx !== -1 && urlParts[stocksIdx + 1]) {
      context.symbol = urlParts[stocksIdx + 1];
    }

    if (!context.symbol) {
      // Selector fallbacks
      const symbolEl = document.querySelector('header h1') || 
                       document.querySelector('[data-testid="symbol-header"]') ||
                       document.querySelector('.sidebar-ticker');
      if (symbolEl) {
        context.symbol = symbolEl.textContent;
      }
    }

    // --- 2. Underlying Price ---
    const priceEl = document.querySelector('span[data-testid="portfolio-value"]') ||
                    document.querySelector('.q-price') ||
                    document.querySelector('main section h1') ||
                    document.querySelector('[data-testid="stock-price"]');
    if (priceEl) {
      context.underlying_price = OptionLensCommon.parseNumber(priceEl.textContent);
    }

    // --- 3. Option Ticket details (usually on the right-hand panel) ---
    // Right panel controls: buy/sell, quantity, limit price
    const rightPanel = document.querySelector('form') || document.querySelector('.sidebar') || document.body;
    
    // Contracts
    const quantityInput = rightPanel.querySelector('input[name="quantity"]') || 
                          rightPanel.querySelector('input[type="number"][placeholder="0"]') ||
                          rightPanel.querySelector('input[aria-label="Contracts"]') ||
                          rightPanel.querySelector('input[placeholder="0"]');
    if (quantityInput) {
      context.contracts = OptionLensCommon.parseIntVal(quantityInput.value);
    }

    // Premium (Limit price)
    const premiumInput = rightPanel.querySelector('input[name="price"]') ||
                         rightPanel.querySelector('input[name="limitPrice"]') ||
                         rightPanel.querySelector('input[placeholder="$0.00"]') ||
                         rightPanel.querySelector('input[aria-label="Limit Price"]');
    if (premiumInput) {
      context.premium = OptionLensCommon.parseNumber(premiumInput.value);
    }

    // Strike and Expiration from options list or option description
    // Robinhood often lists option text like: "AAPL $150 Call 1/15/27" or similar in selected contract summaries
    const selectedContractDesc = document.querySelector('.selected-contract-description') ||
                                 document.querySelector('.contract-row.selected') ||
                                 document.querySelector('[data-testid="selected-contract"]');
    if (selectedContractDesc) {
      const text = selectedContractDesc.textContent;
      this.parseDescriptionText(text, context);
    }

    // Secondary parsing from sidebar buttons or active trade labels
    if (!context.strike || !context.expiration) {
      const orderLabels = Array.from(document.querySelectorAll('span, div, p'));
      for (const el of orderLabels) {
        const text = el.textContent;
        // Example: "AAPL $150.00 Call 1/15/2027" or "$150.00 Call"
        if (text.includes('$') && (text.includes('Call') || text.includes('Put'))) {
          this.parseDescriptionText(text, context);
          if (context.strike && context.expiration) break;
        }
      }
    }

    // Strategy inference from order type labels
    const actionEl = rightPanel.querySelector('.order-type-select') || 
                     rightPanel.querySelector('[data-testid="order-type-dropdown"]');
    const actionText = actionEl ? actionEl.textContent.toLowerCase() : '';
    
    let legs = [];
    if (actionText.includes('sell') || actionText.includes('credit')) {
      legs.push({ action: 'sell', type: window.location.href.includes('put') ? 'put' : 'call' });
    } else {
      legs.push({ action: 'buy', type: window.location.href.includes('put') ? 'put' : 'call' });
    }
    context.strategy = OptionLensCommon.detectStrategy(legs);

    // Clean up symbol
    if (context.symbol) {
      context.symbol = context.symbol.trim().toUpperCase().replace(/[^A-Z]/g, '');
    }

    return context;
  },

  parseDescriptionText(text, context) {
    // Strike: e.g. "$150" or "$150.00"
    const strikeMatch = text.match(/\$(\d+(\.\d{2})?)/);
    if (strikeMatch) {
      context.strike = OptionLensCommon.parseNumber(strikeMatch[1]);
    }

    // Expiration: e.g. "1/15/27" or "01/15/2027" or "Jan 15, 2027"
    const dateMatch = text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/) || 
                      text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i);
    if (dateMatch) {
      context.expiration = OptionLensCommon.normalizeDate(dateMatch[0]);
    }

    // Strategy details
    if (text.toLowerCase().includes('call')) {
      context.strategy = 'covered_call'; // default strategy guess
    } else if (text.toLowerCase().includes('put')) {
      context.strategy = 'cash_secured_put';
    }
  }
};

window.RobinhoodParser = RobinhoodParser;
