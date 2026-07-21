/**
 * OptionLens Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const authView = document.getElementById('auth-view');
  const unauthView = document.getElementById('unauth-view');
  const signupView = document.getElementById('signup-view');

  const userEmail = document.getElementById('user-email');
  const userPlan = document.getElementById('user-plan');
  const usageFraction = document.getElementById('usage-fraction');
  const progressBar = document.getElementById('progress-bar');

  const btnOpenPanel = document.getElementById('btn-open-panel');
  const btnUpgrade = document.getElementById('btn-upgrade');
  const btnLogout = document.getElementById('btn-logout');

  const btnLogin = document.getElementById('btn-login');
  const btnSignup = document.getElementById('btn-signup');
  const btnToggleSignup = document.getElementById('btn-toggle-signup');
  const btnToggleLogin = document.getElementById('btn-toggle-login');

  const loginEmailInput = document.getElementById('login-email');
  const loginPasswordInput = document.getElementById('login-password');
  const signupEmailInput = document.getElementById('signup-email');
  const signupPasswordInput = document.getElementById('signup-password');

  const authError = document.getElementById('auth-error');
  const signupError = document.getElementById('signup-error');

  // Initial State Check
  await checkAuthState();

  // Listen for storage changes to keep auth state in sync
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.auth_token || changes.user_email)) {
      checkAuthState();
    }
  });

  // Navigation / Toggles
  btnToggleSignup.addEventListener('click', () => {
    unauthView.classList.add('hidden');
    signupView.classList.remove('hidden');
    signupError.classList.add('hidden');
  });

  btnToggleLogin.addEventListener('click', () => {
    signupView.classList.add('hidden');
    unauthView.classList.remove('hidden');
    authError.classList.add('hidden');
  });

  // Login Handler
  btnLogin.addEventListener('click', async () => {
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value;

    if (!email || !password) {
      showError(authError, 'Please enter email and password.');
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = 'Signing in...';
    authError.classList.add('hidden');

    chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/auth/login',
      method: 'POST',
      body: { email, password }
    }, async (response) => {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Sign In';

      if (response && response.status === 200 && response.data.token) {
        chrome.runtime.sendMessage({
          type: 'SET_AUTH_STATE',
          token: response.data.token,
          email: response.data.user.email
        }, async () => {
          await checkAuthState();
        });
      } else {
        const msg = response && response.data ? response.data.error : 'Login failed.';
        showError(authError, msg);
      }
    });
  });

  // Registration Handler
  btnSignup.addEventListener('click', async () => {
    const email = signupEmailInput.value.trim();
    const password = signupPasswordInput.value;

    if (!email || !password) {
      showError(signupError, 'Please fill in all fields.');
      return;
    }

    btnSignup.disabled = true;
    btnSignup.textContent = 'Registering...';
    signupError.classList.add('hidden');

    chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/auth/register',
      method: 'POST',
      body: { email, password }
    }, async (response) => {
      btnSignup.disabled = false;
      btnSignup.textContent = 'Register';

      if (response && response.status === 201 && response.data.token) {
        chrome.runtime.sendMessage({
          type: 'SET_AUTH_STATE',
          token: response.data.token,
          email: response.data.user.email
        }, async () => {
          await checkAuthState();
        });
      } else {
        const msg = response && response.data ? response.data.error : 'Registration failed.';
        showError(signupError, msg);
      }
    });
  });

  // Open Side Panel
  btnOpenPanel.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && chrome.sidePanel) {
      chrome.sidePanel.open({ tabId: tab.id });
      window.close(); // Close popup
    }
  });

  // Upgrade Button (Billing Checkout)
  btnUpgrade.addEventListener('click', () => {
    btnUpgrade.disabled = true;
    btnUpgrade.textContent = 'Redirecting...';
    chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/billing/create-checkout-session',
      method: 'POST'
    }, (response) => {
      btnUpgrade.disabled = false;
      btnUpgrade.textContent = '✨ Upgrade to Pro';
      if (response && response.status === 200 && response.data.url) {
        chrome.tabs.create({ url: response.data.url });
      } else {
        alert('Stripe Billing is not configured locally or user has no active email.');
      }
    });
  });

  // Logout Handler
  btnLogout.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_AUTH_STATE' }, () => {
      showUnauthenticated();
    });
  });

  // Check state and fetch limits
  async function checkAuthState() {
    chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' }, async (state) => {
      if (state && state.loggedIn) {
        showAuthenticated(state.email);
        await fetchUsageStats();
      } else {
        showUnauthenticated();
      }
    });
  }

  function showAuthenticated(email) {
    unauthView.classList.add('hidden');
    signupView.classList.add('hidden');
    authView.classList.remove('hidden');
    userEmail.textContent = email;
  }

  function showUnauthenticated() {
    authView.classList.add('hidden');
    signupView.classList.add('hidden');
    unauthView.classList.remove('hidden');
    loginEmailInput.value = '';
    loginPasswordInput.value = '';
  }

  function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
  }

  // Fetch usage events and plan information
  async function fetchUsageStats() {
    chrome.runtime.sendMessage({
      type: 'API_REQUEST',
      endpoint: '/usage/me',
      method: 'GET'
    }, (response) => {
      if (response && response.status === 200 && response.data) {
        const info = response.data;
        const current = info.usage_this_month;
        const limit = info.limit_this_month;
        const plan = info.plan;

        userPlan.textContent = plan.toUpperCase();
        userPlan.className = `badge badge-${plan}`;
        
        usageFraction.textContent = `${current} / ${limit === -1 ? '∞' : limit}`;
        
        const pct = limit === -1 ? 0 : Math.min(100, (current / limit) * 100);
        progressBar.style.width = `${pct}%`;

        // If free plan, show upgrade button
        if (plan === 'free') {
          btnUpgrade.classList.remove('hidden');
        } else {
          btnUpgrade.classList.add('hidden');
        }
      }
    });
  }
});
