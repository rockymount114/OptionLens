# OptionLens Development & Setup Guide

Welcome to **OptionLens**! This guide helps you load the browser extension and set up the local development API.

---

## 📁 Repository Structure
- **[extension/](file:///home/ip114/OptionLens/extension/)**: Chrome/Edge Extension Manifest V3 source code.
  - **[parsers/](file:///home/ip114/OptionLens/extension/parsers/)**: Broker DOM parsers (Fidelity, Robinhood, Webull).
  - **[styles/](file:///home/ip114/OptionLens/extension/styles/)**: CSS styling for Popup and Sidepanel.
- **[api/](file:///home/ip114/OptionLens/api/)**: Flask backend REST API, models, and tests.
- **[infra/](file:///home/ip114/OptionLens/infra/)**: Local Docker Compose configuration and environment variables.

---

## 🔌 Part 1: Loading the Chrome Extension

1. Open **Google Chrome** (or any Chromium-based browser like Microsoft Edge, Brave, or Opera).
2. Navigate to the extensions page: `chrome://extensions/`.
3. In the top-right corner, toggle the **"Developer mode"** switch to **ON**.
4. In the top-left, click the **"Load unpacked"** button.
5. In the file picker, select the **[extension/](file:///home/ip114/OptionLens/extension/)** directory inside this repository.
6. OptionLens will now appear in your extension list! Click the Puzzle icon in Chrome's toolbar and pin **OptionLens** for easy access.

---

## ⚙️ Part 2: Starting the Flask API

You can start the Flask API locally using either **Docker Compose** or a **Local SQLite Server**.

### Method A: Local SQLite (Easiest for Solo Development)
1. Navigate to the `/api` directory.
2. Install the python dependencies (if you have python pip installed):
   ```bash
   pip install -r requirements.txt
   ```
3. Run the development server:
   ```bash
   python wsgi.py
   ```
   *Note: In SQLite development mode, the Flask app factory in `app/__init__.py` automatically creates the database file `optionlens.db` and initial schemas.*

### Method B: Docker Compose (PostgreSQL Production-like Testing)
1. Navigate to the `/infra` directory.
2. Run the docker compose services:
   ```bash
   docker compose up --build
   ```
3. This command builds the custom Flask image and sets up a PostgreSQL 16 server mapping database ports on `5432` and Flask on `5000`.

---

## 🧪 Part 3: Running Tests

To verify user registration, login flows, calculations, and paywall limit enforcement:

### Running Backend Unit Tests (Locally)
If you have dependencies installed locally, run:
```bash
cd api
python3 -m unittest tests/test_backend.py
```

### Running Backend Unit Tests (In Docker)
If you are running the API via docker-compose:
```bash
docker compose exec api python -m unittest tests/test_backend.py
```

---

## 💡 Part 4: Exploring Features

### 1. Register & Login
Click the OptionLens extension icon to open the Popup. Enter an email and password to create an account or sign in. This saves your credentials in secure browser local storage.

### 2. Live Page Extraction
Open an option contract order page on **Fidelity** or **Robinhood**. OptionLens automatically detects the broker page and injects a floating button: **"Analyze with OptionLens"** at the bottom right. 
Click it to automatically parse underlying price, strikes, premiums, and expirations, and launch the side panel!

### 3. Real-Time Payoff Simulator
In the Side Panel, you can modify any contract parameter (premium, strike, ticker) manually. The client-side payoff engine immediately recalculates:
- Maximum Profit
- Maximum Loss
- Breakeven Price
- Yield %
- An interactive **What-If Scenario Table** showing P&L at +/- 20% price intervals.

### 4. Gated Deep Explanations (Paywall)
Click **"Analyze Trade"** in the side panel to request a plain-English explanation from the backend.
- **Free Plan**: Restricted to **10 analyses per month**.
- **Billing Checkout Simulation**: Under the popup menu, clicking **"Upgrade to Pro"** redirects to a simulated checkout screen which automatically upgrades your plan state to **Pro** in the database, lifting your monthly limit to **200 analyses**.
