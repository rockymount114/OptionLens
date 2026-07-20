# OptionLens 🔍📊

OptionLens is a Chrome and Edge browser extension that reads options trading interfaces (such as **Fidelity** or **Robinhood**), extracts contract details dynamically, calculates risk/reward parameters, and explains the strategy in plain English inside a side panel.

---

## 🚀 Key Features

- **DOM Extraction**: Automatically parses underlying price, strategy type, strikes, premiums, expirations, and contract size directly from active trade tickets.
- **Dynamic Payoff Engine**: Immediately simulates maximum profit, maximum loss, breakeven, yields, and generates **What-If Scenario tables** client-side on parameter edits.
- **Server-Side Quota Paywall**: Enforces user authentication and monthly analysis limits on the backend Flask API. Includes a Stripe checkout simulation.
- **Plain-English Explanations**: Details structural options strategies (Covered Calls, Cash-Secured Puts, Long Calls, Long Puts) to avoid complicated financial jargon.

---

## 📁 Repository Layout

- **[extension/](file:///home/ip114/OptionLens/extension/)**: Chrome Extension (Manifest V3) codebase.
  - **[manifest.json](file:///home/ip114/OptionLens/extension/manifest.json)**: Extension configuration and host matches.
  - **[service-worker.js](file:///home/ip114/OptionLens/extension/service-worker.js)**: Message passing router, API proxy, and state manager.
  - **[content-script.js](file:///home/ip114/OptionLens/extension/content-script.js)**: Runs selectors on brokerage pages and embeds a floating action trigger.
  - **[popup.html](file:///home/ip114/OptionLens/extension/popup.html)** & **[popup.js](file:///home/ip114/OptionLens/extension/popup.js)**: User registration, login, and monthly quota progress tracker.
  - **[sidepanel.html](file:///home/ip114/OptionLens/extension/sidepanel.html)** & **[sidepanel.js](file:///home/ip114/OptionLens/extension/sidepanel.js)**: Visual dashboard showing payoff math, scenario matrix, and risk analysis.
- **[api/](file:///home/ip114/OptionLens/api/)**: Backend Python Flask API.
  - **[wsgi.py](file:///home/ip114/OptionLens/api/wsgi.py)**: Bootstrapping script.
  - **[requirements.txt](file:///home/ip114/OptionLens/api/requirements.txt)**: App dependencies.
  - **[Dockerfile](file:///home/ip114/OptionLens/api/Dockerfile)**: Docker image assembly.
  - **[tests/test_backend.py](file:///home/ip114/OptionLens/api/tests/test_backend.py)**: Automated verification tests.
- **[infra/](file:///home/ip114/OptionLens/infra/)**: Deployment configuration.
  - **[docker-compose.yml](file:///home/ip114/OptionLens/infra/docker-compose.yml)**: Multicontainer orchestration mapping Flask and PostgreSQL.

---

## 🛠️ Installation & Setup

For step-by-step instructions on loading the unpacked browser extension, setting up the API (either locally using SQLite or via Docker using PostgreSQL), and running backend test suites, please refer to:

👉 **[GETTING_STARTED.md (Setup Guide)](file:///home/ip114/OptionLens/docs/GETTING_STARTED.md)**

---

## ⚖️ Disclaimer
OptionLens is an educational and payoff-modeling tool. It does not provide personalized investment advice or recommendations to buy or sell securities.
