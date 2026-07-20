/**
 * OptionLens Common Parser Utilities
 */

const OptionLensCommon = {
  // Parse numeric values (e.g. "$150.25" -> 150.25)
  parseNumber(val) {
    if (val === undefined || val === null) return null;
    const clean = val.toString().replace(/[^0-9.-]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
  },

  // Parse integer values (e.g. "100" -> 100)
  parseIntVal(val) {
    if (val === undefined || val === null) return null;
    const clean = val.toString().replace(/[^0-9-]/g, '');
    const num = parseInt(clean, 10);
    return isNaN(num) ? null : num;
  },

  // Normalize date format to YYYY-MM-DD
  normalizeDate(dateStr) {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Fallback or custom regex patterns if Date constructor fails
        return dateStr;
      }
      return d.toISOString().split('T')[0];
    } catch (e) {
      return dateStr;
    }
  },

  // Detect option strategy based on option leg components
  detectStrategy(legs) {
    if (!legs || legs.length === 0) return null;

    if (legs.length === 1) {
      const leg = legs[0];
      const action = leg.action.toLowerCase(); // buy/sell
      const type = leg.type.toLowerCase();     // call/put

      if (action === 'sell' && type === 'call') {
        return 'covered_call'; // usually represented as sell-to-open call (covered by shares)
      }
      if (action === 'sell' && type === 'put') {
        return 'cash_secured_put'; // sell-to-open put (secured by cash)
      }
      if (action === 'buy' && type === 'call') {
        return 'long_call';
      }
      if (action === 'buy' && type === 'put') {
        return 'long_put';
      }
    }
    return 'custom';
  },

  // Normalize payload format for explain request
  buildPayload(broker, symbol, strategy, underlyingPrice, strike, premium, contracts, expiration, sharesCovered, url) {
    return {
      broker: broker,
      symbol: symbol ? symbol.toUpperCase() : null,
      strategy: strategy || 'unknown',
      underlying_price: this.parseNumber(underlyingPrice),
      strike: this.parseNumber(strike),
      premium: this.parseNumber(premium),
      contracts: this.parseIntVal(contracts) || 1,
      expiration: this.normalizeDate(expiration),
      shares_covered: this.parseIntVal(sharesCovered) || 100,
      page_context: {
        source_url: url || window.location.href,
        captured_at: new Date().toISOString()
      }
    };
  }
};

window.OptionLensCommon = OptionLensCommon;
