/**
 * Fidelity Option Parser
 */

const FidelityParser = {
  detect() {
    return window.location.hostname.includes('fidelity.com');
  },

  parse() {
    const context = {
      broker: 'fidelity',
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

    // --- 1. Symbol parsing ---
    // Look for symbol input or header
    let symbolEl = document.querySelector('#eq-ticket-dest-symbol') || 
                   document.querySelector('input[placeholder="Enter Symbol"]') ||
                   document.querySelector('.eq-ticket__symbol') ||
                   document.querySelector('.symbol-header h1') ||
                   document.querySelector('[data-testid="symbol-header"]') ||
                   document.querySelector('.quote-symbol');
    
    if (symbolEl) {
      context.symbol = symbolEl.value || symbolEl.textContent;
    }

    // --- 2. Underlying Price ---
    let priceEl = document.querySelector('.eq-ticket__last-price') ||
                  document.querySelector('.quote-price') ||
                  document.querySelector('[data-testid="last-price"]') ||
                  document.querySelector('.last-price');
    if (priceEl) {
      context.underlying_price = OptionLensCommon.parseNumber(priceEl.textContent);
    }

    // --- 3. Option Details ---
    // Fidelity option chains and trade tickets have specific selectors depending on version (Classic vs. Beta)
    // We try multiple approaches:
    
    // Approach A: Active Trade Ticket fields
    let contractsEl = document.querySelector('#eq-ticket-quantity') || 
                      document.querySelector('input[name="quantity"]') ||
                      document.querySelector('.eq-ticket__quantity input');
    if (contractsEl) {
      context.contracts = OptionLensCommon.parseIntVal(contractsEl.value || contractsEl.textContent);
    }

    // If it's a multi-leg or single leg dropdown/options list
    let strikeEl = document.querySelector('.strike-price') || 
                   document.querySelector('[data-testid="strike-price"]') ||
                   document.querySelector('select[name="strike"]') ||
                   document.querySelector('.eq-option-strike');
    if (strikeEl) {
      context.strike = OptionLensCommon.parseNumber(strikeEl.value || strikeEl.textContent);
    }

    let expirationEl = document.querySelector('.expiration-date') || 
                       document.querySelector('[data-testid="expiration"]') ||
                       document.querySelector('select[name="expiration"]') ||
                       document.querySelector('.eq-option-expiration');
    if (expirationEl) {
      context.expiration = OptionLensCommon.normalizeDate(expirationEl.value || expirationEl.textContent);
    }

    let premiumEl = document.querySelector('.limit-price input') ||
                    document.querySelector('#eq-ticket-limit-price') ||
                    document.querySelector('[data-testid="premium"]') ||
                    document.querySelector('.bid-ask-midpoint');
    if (premiumEl) {
      context.premium = OptionLensCommon.parseNumber(premiumEl.value || premiumEl.textContent);
    }

    // Determine Action & Option Type
    let actionEl = document.querySelector('select[name="action"]') || 
                   document.querySelector('.option-action-select') ||
                   document.querySelector('.eq-ticket__action');
    let actionText = actionEl ? (actionEl.value || actionEl.textContent) : '';

    let typeEl = document.querySelector('select[name="optionType"]') || 
                 document.querySelector('.option-type-select') ||
                 document.querySelector('.eq-ticket__option-type');
    let typeText = typeEl ? (typeEl.value || typeEl.textContent) : '';

    // Standardize strategy
    let legs = [];
    if (actionText && typeText) {
      let action = 'buy';
      if (actionText.toLowerCase().includes('sell') || actionText.toLowerCase().includes('write')) {
        action = 'sell';
      }
      let type = 'call';
      if (typeText.toLowerCase().includes('put')) {
        type = 'put';
      }
      legs.push({ action, type });
      context.strategy = OptionLensCommon.detectStrategy(legs);
    }

    // Clean up symbol
    if (context.symbol) {
      context.symbol = context.symbol.trim().toUpperCase().replace(/[^A-Z]/g, '');
    }

    // Fallback: search DOM tables if details aren't filled in the ticket
    if (!context.strike || !context.expiration) {
      this.parseFromTables(context);
    }

    return context;
  },

  // Fallback to searching tables
  parseFromTables(context) {
    // Try to find selected rows in option chains
    const selectedRows = document.querySelectorAll('.selected-row, .option-row.active, tr.selected');
    if (selectedRows.length > 0) {
      const row = selectedRows[0];
      // Search cells for strikes, expirations, premiums
      const cells = Array.from(row.querySelectorAll('td'));
      cells.forEach(cell => {
        const txt = cell.textContent.trim();
        // Expiration check (e.g. "Jan 15, 2027" or "01/15/2027")
        if (txt.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}\b/i) || txt.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          context.expiration = OptionLensCommon.normalizeDate(txt);
        }
        // Strike check: look for numbers like 150.00, 350, etc.
        const num = OptionLensCommon.parseNumber(txt);
        if (num && cell.classList.contains('strike')) {
          context.strike = num;
        }
      });
    }
  }
};

window.FidelityParser = FidelityParser;
