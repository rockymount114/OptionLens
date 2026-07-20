/**
 * OptionLens Sidepanel Javascript
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const authStatus = document.getElementById('auth-status');
  const errorBox = document.getElementById('error-box');

  const inputSymbol = document.getElementById('input-symbol');
  const inputStrategy = document.getElementById('input-strategy');
  const inputUnderlying = document.getElementById('input-underlying');
  const inputStrike = document.getElementById('input-strike');
  const inputPremium = document.getElementById('input-premium');
  const inputContracts = document.getElementById('input-contracts');
  const inputExpiration = document.getElementById('input-expiration');
  const inputShares = document.getElementById('input-shares');

  const btnPullDom = document.getElementById('btn-pull-dom');
  const btnAnalyze = document.getElementById('btn-analyze');
  const detectedBrokerBadge = document.getElementById('detected-broker-badge');

  // Payoff outputs
  const metricMaxProfit = document.getElementById('metric-max-profit');
  const metricMaxLoss = document.getElementById('metric-max-loss');
  const metricBreakeven = document.getElementById('metric-breakeven');
  const metricYield = document.getElementById('metric-yield');

  // Explanations
  const explanationText = document.getElementById('explanation-text');
  const assignmentContainer = document.getElementById('assignment-container');
  const assignmentRiskText = document.getElementById('assignment-risk-text');

  // Scenarios
  const scenarioTbody = document.getElementById('scenario-tbody');

  // Embedded Auth elements
  const sidepanelAuthCard = document.getElementById('sidepanel-auth-card');
  const sidepanelMainContent = document.getElementById('sidepanel-main-content');
  const authEmailInput = document.getElementById('auth-email');
  const authPasswordInput = document.getElementById('auth-password');
  const btnSideLogin = document.getElementById('btn-side-login');
  const btnSideRegister = document.getElementById('btn-side-register');
  const authMsg = document.getElementById('auth-msg');

  // Load initial authentication state
  checkAuth();

  // Embedded Sidepanel Auth handlers
  btnSideLogin.addEventListener('click', () => {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if (!email || !password) {
      showAuthError('Please enter email and password.');
      return;
    }
    btnSideLogin.disabled = true;
    btnSideLogin.textContent = 'Signing in...';
    hideAuthError();

    chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/auth/login',
      method: 'POST',
      body: { email, password }
    }, (response) => {
      btnSideLogin.disabled = false;
      btnSideLogin.textContent = 'Sign In';
      if (response && response.status === 200 && response.data.token) {
        chrome.runtime.sendMessage({
          type: 'SET_AUTH_STATE',
          token: response.data.token,
          email: response.data.user.email
        }, () => {
          checkAuth();
        });
      } else {
        const msg = response && response.data ? response.data.error : 'Login failed.';
        showAuthError(msg);
      }
    });
  });

  btnSideRegister.addEventListener('click', () => {
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;
    if (!email || !password) {
      showAuthError('Please enter email and password.');
      return;
    }
    btnSideRegister.disabled = true;
    btnSideRegister.textContent = 'Registering...';
    hideAuthError();

    chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/auth/register',
      method: 'POST',
      body: { email, password }
    }, (response) => {
      btnSideRegister.disabled = false;
      btnSideRegister.textContent = 'Register';
      if (response && response.status === 201 && response.data.token) {
        chrome.runtime.sendMessage({
          type: 'SET_AUTH_STATE',
          token: response.data.token,
          email: response.data.user.email
        }, () => {
          checkAuth();
        });
      } else {
        const msg = response && response.data ? response.data.error : 'Registration failed.';
        showAuthError(msg);
      }
    });
  });

  // Load latest data from storage if available
  chrome.storage.local.get('latest_extracted_data', (result) => {
    if (result.latest_extracted_data) {
      prefillForm(result.latest_extracted_data);
    }
  });

  // Listen for background updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'DATA_UPDATED' && message.data) {
      prefillForm(message.data);
    }
  });

  // Pull data from page
  btnPullDom.addEventListener('click', async () => {
    hideError();
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showError('No active browser tab found.');
      return;
    }

    btnPullDom.disabled = true;
    btnPullDom.textContent = '🔄 Reading...';

    chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE_DATA' }, (response) => {
      btnPullDom.disabled = false;
      btnPullDom.textContent = '🔄 Read Page';

      if (chrome.runtime.lastError) {
        showError('Could not communicate with the page. Try refreshing the broker tab.');
        return;
      }

      if (response && response.success && response.data) {
        prefillForm(response.data);
      } else {
        showError('Could not extract options details from this page layout.');
      }
    });
  });

  // Form input listeners for real-time local calculations
  const formInputs = [inputSymbol, inputStrategy, inputUnderlying, inputStrike, inputPremium, inputContracts, inputExpiration, inputShares];
  formInputs.forEach(input => {
    input.addEventListener('input', runLocalCalculations);
  });

  // Send request for server explanation
  btnAnalyze.addEventListener('click', async () => {
    hideError();
    
    // Check authentication first
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (state) => {
      if (!state || !state.loggedIn) {
        showError('Please sign in via the OptionLens extension icon in your browser toolbar.');
        return;
      }

      const payload = getPayloadFromForm();
      if (!payload.symbol || !payload.underlying_price || !payload.strike || !payload.premium) {
        showError('Please fill in Symbol, Stock Price, Strike, and Premium.');
        return;
      }

      // Show loader
      btnAnalyze.disabled = true;
      btnAnalyze.innerHTML = '<span class="loading-spinner"></span> Analyzing...';
      explanationText.innerHTML = 'Analyzing options structure and calculating outcomes...';

      chrome.runtime.sendMessage({
        type: 'API_REQUEST',
        endpoint: '/analysis/explain',
        method: 'POST',
        body: payload
      }, (response) => {
        btnAnalyze.disabled = false;
        btnAnalyze.innerHTML = 'Analyze Trade';

        if (response && response.status === 200 && response.data) {
          renderServerExplanation(response.data);
        } else {
          const errMsg = response && response.data && response.data.error 
            ? response.data.error 
            : 'Error communicating with server explanation engine.';
          showError(errMsg);
          explanationText.innerHTML = 'Failed to load educational explanation.';
        }
      });
    });
  });

  function prefillForm(data) {
    if (!data) return;

    if (data.broker) detectedBrokerBadge.textContent = data.broker.toUpperCase();
    if (data.symbol) inputSymbol.value = data.symbol;
    if (data.strategy) inputStrategy.value = data.strategy;
    if (data.underlying_price) inputUnderlying.value = data.underlying_price;
    if (data.strike) inputStrike.value = data.strike;
    if (data.premium) inputPremium.value = data.premium;
    if (data.contracts) inputContracts.value = data.contracts;
    if (data.expiration) inputExpiration.value = data.expiration;
    if (data.shares_covered) inputShares.value = data.shares_covered;

    runLocalCalculations();
  }

  function getPayloadFromForm() {
    return {
      broker: detectedBrokerBadge.textContent.toLowerCase() || 'custom',
      symbol: inputSymbol.value.trim().toUpperCase(),
      strategy: inputStrategy.value,
      underlying_price: parseFloat(inputUnderlying.value) || 0,
      strike: parseFloat(inputStrike.value) || 0,
      premium: parseFloat(inputPremium.value) || 0,
      contracts: parseInt(inputContracts.value) || 1,
      expiration: inputExpiration.value || null,
      shares_covered: parseInt(inputShares.value) || 100,
      page_context: {
        source_url: window.location.href,
        captured_at: new Date().toISOString()
      }
    };
  }

  function runLocalCalculations() {
    const symbol = inputSymbol.value.toUpperCase();
    const strategy = inputStrategy.value;
    const stockPrice = parseFloat(inputUnderlying.value) || 0;
    const strike = parseFloat(inputStrike.value) || 0;
    const premium = parseFloat(inputPremium.value) || 0;
    const contracts = parseInt(inputContracts.value) || 1;
    const shares = parseInt(inputShares.value) || 100;
    const multiplier = contracts * shares;

    if (stockPrice <= 0 || strike <= 0 || premium <= 0) {
      resetMetrics();
      return;
    }

    let maxProfit = 0;
    let maxLoss = 0;
    let breakeven = 0;
    let optYield = 0;
    let scenarios = [];

    // Local Strategy payoff formulas
    if (strategy === 'covered_call') {
      // Premium received + Capital gain (if called away at strike)
      maxProfit = ((strike - stockPrice) + premium) * multiplier;
      // If stock goes to 0, loss is stock purchase price minus premium
      maxLoss = (stockPrice - premium) * multiplier;
      breakeven = stockPrice - premium;
      optYield = (premium / stockPrice) * 100;

      scenarios = [
        { pct: -20, label: '-20% Drop' },
        { pct: -10, label: '-10% Dip' },
        { customVal: breakeven, label: 'Breakeven' },
        { customVal: strike, label: 'At Strike' },
        { pct: 10, label: '+10% Rise' },
        { pct: 20, label: '+20% Rise' }
      ].map(sc => calculateScenarioCoveredCall(sc, stockPrice, strike, premium, multiplier));
    } 
    
    else if (strategy === 'cash_secured_put') {
      // Premium received
      maxProfit = premium * multiplier;
      // Must buy stock at strike if put is exercised, offset by premium
      maxLoss = (strike - premium) * multiplier;
      breakeven = strike - premium;
      optYield = (premium / strike) * 100; // Yield on collateral

      scenarios = [
        { pct: -20, label: '-20% Drop' },
        { pct: -10, label: '-10% Dip' },
        { customVal: breakeven, label: 'Breakeven' },
        { customVal: strike, label: 'At Strike' },
        { pct: 10, label: '+10% Rise' }
      ].map(sc => calculateScenarioCashSecuredPut(sc, stockPrice, strike, premium, multiplier));
    } 
    
    else if (strategy === 'long_call') {
      maxProfit = Infinity;
      maxLoss = premium * multiplier;
      breakeven = strike + premium;
      optYield = -100; // Capital risk

      scenarios = [
        { pct: -10, label: '-10% Dip' },
        { customVal: strike, label: 'At Strike' },
        { customVal: breakeven, label: 'Breakeven' },
        { pct: 10, label: '+10% Rise' },
        { pct: 20, label: '+20% Rise' }
      ].map(sc => calculateScenarioLongCall(sc, stockPrice, strike, premium, multiplier));
    } 
    
    else if (strategy === 'long_put') {
      // Stock goes to zero
      maxProfit = (strike - premium) * multiplier;
      maxLoss = premium * multiplier;
      breakeven = strike - premium;
      optYield = -100;

      scenarios = [
        { pct: -20, label: '-20% Drop' },
        { pct: -10, label: '-10% Dip' },
        { customVal: breakeven, label: 'Breakeven' },
        { customVal: strike, label: 'At Strike' },
        { pct: 10, label: '+10% Rise' }
      ].map(sc => calculateScenarioLongPut(sc, stockPrice, strike, premium, multiplier));
    }

    // Format payoff metrics display
    metricMaxProfit.textContent = maxProfit === Infinity ? 'Infinite' : formatCurrency(maxProfit);
    metricMaxProfit.className = `metric-value value-green`;
    
    metricMaxLoss.textContent = formatCurrency(maxLoss);
    metricMaxLoss.className = `metric-value value-red`;

    metricBreakeven.textContent = formatCurrency(breakeven);
    
    metricYield.textContent = optYield === -100 ? 'N/A' : `${optYield.toFixed(2)}%`;
    metricYield.className = `metric-value ${optYield >= 0 ? 'value-green' : 'value-red'}`;

    renderScenariosTable(scenarios);
  }

  function calculateScenarioCoveredCall(sc, entryPrice, strike, premium, multiplier) {
    const price = sc.customVal !== undefined ? sc.customVal : entryPrice * (1 + sc.pct / 100);
    let pnl = 0;
    let desc = '';

    if (price >= strike) {
      pnl = ((strike - entryPrice) + premium) * multiplier;
      desc = `Shares called away at $${strike.toFixed(2)}. Max profit reached.`;
    } else {
      pnl = ((price - entryPrice) + premium) * multiplier;
      desc = price < (entryPrice - premium) 
        ? `Option expires worthless. Net loss on shares.`
        : `Option expires worthless. Kept premium, unrealized share difference.`;
    }

    return { price, label: sc.label, pnl, desc };
  }

  function calculateScenarioCashSecuredPut(sc, entryPrice, strike, premium, multiplier) {
    const price = sc.customVal !== undefined ? sc.customVal : entryPrice * (1 + sc.pct / 100);
    let pnl = 0;
    let desc = '';

    if (price >= strike) {
      pnl = premium * multiplier;
      desc = 'Option expires worthless. Keep full premium.';
    } else {
      pnl = ((price - strike) + premium) * multiplier;
      desc = `Assigned at $${strike.toFixed(2)}. Owning stock with cost basis $${(strike - premium).toFixed(2)}.`;
    }

    return { price, label: sc.label, pnl, desc };
  }

  function calculateScenarioLongCall(sc, entryPrice, strike, premium, multiplier) {
    const price = sc.customVal !== undefined ? sc.customVal : entryPrice * (1 + sc.pct / 100);
    let pnl = 0;
    let desc = '';

    if (price > strike) {
      pnl = (price - strike - premium) * multiplier;
      desc = pnl > 0 ? `Option is ITM. Net profit: ${formatCurrency(pnl)}.` : `Option is ITM, but premium not fully recovered.`;
    } else {
      pnl = -premium * multiplier;
      desc = 'Option expires worthless. Full premium lost.';
    }

    return { price, label: sc.label, pnl, desc };
  }

  function calculateScenarioLongPut(sc, entryPrice, strike, premium, multiplier) {
    const price = sc.customVal !== undefined ? sc.customVal : entryPrice * (1 + sc.pct / 100);
    let pnl = 0;
    let desc = '';

    if (price < strike) {
      pnl = (strike - price - premium) * multiplier;
      desc = pnl > 0 ? `Option is ITM. Net profit: ${formatCurrency(pnl)}.` : `Option is ITM, but premium not fully recovered.`;
    } else {
      pnl = -premium * multiplier;
      desc = 'Option expires worthless. Full premium lost.';
    }

    return { price, label: sc.label, pnl, desc };
  }

  function renderScenariosTable(scenarios) {
    scenarioTbody.innerHTML = '';
    scenarios.forEach(sc => {
      const row = document.createElement('tr');
      
      const pnlClass = sc.pnl > 0 ? 'value-green' : (sc.pnl < 0 ? 'value-red' : '');
      const formattedPnl = sc.pnl === Infinity ? 'Infinite' : formatCurrency(sc.pnl);

      row.innerHTML = `
        <td><strong>$${sc.price.toFixed(2)}</strong><br/><span style="font-size:10px; color:var(--text-muted);">${sc.label}</span></td>
        <td class="${pnlClass}"><strong>${formattedPnl}</strong></td>
        <td style="color: var(--text-muted); font-size: 11px;">${sc.desc}</td>
      `;
      scenarioTbody.appendChild(row);
    });
  }

  function renderServerExplanation(data) {
    if (data.summary) {
      explanationText.textContent = data.summary;
    }
    
    if (data.assignment_risk) {
      assignmentRiskText.textContent = data.assignment_risk;
      assignmentContainer.classList.remove('hidden');
    } else {
      assignmentContainer.classList.add('hidden');
    }

    // Refresh local calculations as well
    runLocalCalculations();
  }

  function resetMetrics() {
    metricMaxProfit.textContent = '$0.00';
    metricMaxLoss.textContent = '$0.00';
    metricBreakeven.textContent = '$0.00';
    metricYield.textContent = '0.0%';
    scenarioTbody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; color: var(--text-muted);">
          Enter valid prices to compute.
        </td>
      </tr>
    `;
  }

  function checkAuth() {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, (state) => {
      if (state && state.loggedIn) {
        authStatus.textContent = `Active: ${state.email}`;
        sidepanelAuthCard.classList.add('hidden');
        sidepanelMainContent.classList.remove('hidden');
      } else {
        authStatus.textContent = 'Not signed in';
        sidepanelAuthCard.classList.remove('hidden');
        sidepanelMainContent.classList.add('hidden');
      }
    });
  }

  function showAuthError(msg) {
    authMsg.textContent = msg;
    authMsg.classList.remove('hidden');
  }

  function hideAuthError() {
    authMsg.classList.add('hidden');
    authMsg.textContent = '';
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
    errorBox.textContent = '';
  }

  function formatCurrency(val) {
    if (val === Infinity) return 'Infinite';
    const isNegative = val < 0;
    const cleanVal = Math.abs(val).toFixed(2);
    return isNegative ? `-$${cleanVal}` : `$${cleanVal}`;
  }
});
