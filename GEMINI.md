## Project

**Name:** OptionLens  
**Type:** Browser Extension + API SaaS  
**Stack:** Chrome/Edge Extension (Manifest V3) + Flask API + Stripe + PostgreSQL/SQLite

## Goal

OptionLens is a browser extension that reads an options trading page, extracts contract details from the current tab, calculates risk/reward, and explains the trade in plain language. The extension should prioritize covered calls and cash-secured puts in v1 because these strategies are easier to validate, easier to explain, and less likely to drift into overbroad financial advice claims.

The main product entry point should be the browser extension rather than a standalone website because Chrome extensions are designed to run content scripts on active pages and coordinate background logic through an extension service worker.[cite:31][cite:36][cite:44] A lightweight backend API is still needed for authentication, billing, quotas, account state, analytics, and any server-side explanation or AI enrichment.[cite:38]

## Product Principles

- Solve one narrow problem well: explain the option currently visible on the page.
- Do not start as a portfolio tracker, broker replacement, or general stock screener.
- Position the product as an educational and analysis tool, not as investment advice.
- Minimize permissions and collected data because Chrome policies increasingly emphasize narrow purpose, privacy disclosures, and least-privilege access.[cite:10][cite:11][cite:12][cite:13]
- Keep the first release rule-based where possible; add AI only after the core parser and calculator are reliable.

## Recommended Architecture

```text
[Browser Tab: broker/options page]
          |
          v
[Content Script]
  - Read DOM
  - Extract ticker, strategy, strike, premium, expiration, quantity
  - Inject side panel UI
          |
          v
[Extension Service Worker]
  - Auth token handling
  - Message routing
  - API calls
  - Usage/quota checks
          |
          v
[Flask API]
  - REST endpoints
  - User/account management
  - Stripe webhook handling
  - Explanation engine
  - Analytics events
          |
          +----------------------+
          |                      |
          v                      v
   [PostgreSQL prod]      [SQLite local/dev]
          |
          v
       [Stripe]
```

Manifest V3 extensions split responsibilities across content scripts, UI surfaces, and a service worker, which makes this architecture a natural fit for DOM extraction plus background API communication.[cite:31][cite:39][cite:43] The backend should remain stateless at the app tier and store durable account, subscription, and usage data in PostgreSQL for production; SQLite is sufficient for local development and early prototyping.[cite:38]

## Why Flask Here

Flask is a strong fit for the first backend because it is simple to ship, works well in Docker, and aligns with an existing Python-heavy development workflow.[cite:25] This project also benefits from Python for calculation routines, strategy templates, validation logic, and later AI orchestration.

Next.js can still be added later for a marketing site or account dashboard, but it should not replace the extension as the primary interaction model because the core product value depends on reading the current options page in-browser.[cite:31][cite:36]

## Monorepo Layout

```text
optionlens/
├─ extension/
│  ├─ manifest.json
│  ├─ service-worker.js
│  ├─ content-script.js
│  ├─ popup.html
│  ├─ popup.js
│  ├─ sidepanel.html
│  ├─ sidepanel.js
│  ├─ styles/
│  └─ icons/
├─ api/
│  ├─ app/
│  │  ├─ __init__.py
│  │  ├─ config.py
│  │  ├─ extensions.py
│  │  ├─ models/
│  │  ├─ routes/
│  │  ├─ services/
│  │  ├─ schemas/
│  │  └─ utils/
│  ├─ migrations/
│  ├─ tests/
│  ├─ requirements.txt
│  ├─ wsgi.py
│  └─ Dockerfile
├─ infra/
│  ├─ docker-compose.yml
│  ├─ nginx/
│  └─ env/
├─ docs/
└─ GEMINI.md
```

## Extension Responsibilities

### 1. Content Script

The content script should only do page-local work:
- Detect supported broker domains.
- Parse the visible page DOM.
- Normalize contract fields.
- Render a compact overlay or trigger the side panel.
- Send extracted payloads to the service worker.

Content scripts operate in the context of the page and are the right place for DOM access, while sensitive coordination should be passed back to the extension runtime through message passing.[cite:36][cite:39]

### 2. Service Worker

The extension service worker should handle:
- Login state and bearer token memory.
- Message routing between popup, side panel, and content script.
- Secure API requests.
- Caching short-lived results in memory.
- Plan and quota checks before analysis requests.

Extension service workers are the central event handler in Manifest V3 and replace the old background-page model.[cite:31][cite:44]

### 3. Popup / Side Panel

Use the popup for quick status and account controls:
- Logged in / not logged in
- Remaining analyses this month
- Open side panel
- Upgrade button

Use the side panel for the real product experience:
- Detected strategy
- Key numbers
- Plain-English explanation
- Risk summary
- What-if scenarios
- Upgrade gating

## Flask API Responsibilities

The Flask API should own all server-trust concerns:
- User registration and login
- Email magic link or passwordless auth
- Stripe checkout session creation
- Stripe webhook verification and subscription state sync
- Usage meter enforcement
- Explanation request processing
- Audit/event logging
- Feature flag responses

Keep the API cleanly separated into route, service, schema, and model layers so the extension can stay thin and mostly presentational.

## Core Endpoints

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/analysis/extract-preview
POST   /api/analysis/explain
GET    /api/usage/me
POST   /api/billing/create-checkout-session
POST   /api/billing/create-portal-session
POST   /api/webhooks/stripe
GET    /api/plans
GET    /api/health
```

### Suggested explain payload

```json
{
  "broker": "fidelity",
  "symbol": "TSLA",
  "strategy": "covered_call",
  "underlying_price": 350.00,
  "strike": 380.00,
  "premium": 5.00,
  "contracts": 1,
  "expiration": "2027-01-15",
  "shares_covered": 100,
  "page_context": {
    "source_url": "https://example-broker/options/...",
    "captured_at": "2026-07-20T10:00:00Z"
  }
}
```

### Suggested explain response

```json
{
  "strategy_label": "Sell Covered Call",
  "summary": "You collect $500 now. If TSLA stays at or below $380 through expiration, you keep the premium and your shares.",
  "max_profit": 3500.00,
  "max_loss": "Substantial downside if shares fall; premium only partially offsets loss.",
  "breakeven": 345.00,
  "assignment_risk": "Possible if shares move above strike or the call is deep ITM near expiration.",
  "scenarios": [
    {
      "price": 340,
      "outcome": "Option likely expires worthless; unrealized stock loss partially offset by premium."
    },
    {
      "price": 380,
      "outcome": "Maximum planned outcome if called away at strike."
    },
    {
      "price": 420,
      "outcome": "Upside above strike is capped; shares may be called away."
    }
  ],
  "usage": {
    "plan": "free",
    "remaining_this_month": 4
  }
}
```

## Data Model

### tables: users
- id
- email
- password_hash or magic_link_only
- created_at
- last_login_at
- is_active
- stripe_customer_id

### tables: subscriptions
- id
- user_id
- stripe_subscription_id
- stripe_price_id
- plan_name
- status
- current_period_end
- cancel_at_period_end
- created_at
- updated_at

### tables: usage_events
- id
- user_id
- event_type
- symbol
- strategy
- broker
- created_at
- request_units

### tables: analysis_requests
- id
- user_id
- broker
- source_url_hash
- symbol
- strategy
- request_payload_json
- response_payload_json
- created_at

### tables: supported_brokers
- id
- broker_key
- display_name
- is_enabled
- parser_version
- updated_at

PostgreSQL should be the production default because subscription state, usage metering, and analytics are operational data that benefit from a reliable relational store. SQLite is appropriate for local development, single-user demos, and early-stage testing when deployment simplicity matters more than concurrency.[cite:38]

## Billing Design

Stripe should manage:
- checkout
- customer portal
- recurring subscriptions
- failed payment lifecycle
- invoices
- subscription status webhooks

The Flask API should never trust only the client for plan state; it should derive entitlement from Stripe-backed server records after webhook processing. This avoids users unlocking premium features by tampering with extension-side state.

### suggested plans

| Plan | Price | Features |
|---|---:|---|
| Free | $0 | 10 analyses/month, covered call + cash-secured put only |
| Pro | $9.99/month | 200 analyses/month, scenario engine, history |
| Power | $19.99/month | unlimited fair-use analyses, advanced explanations, multi-broker support |

Chrome Web Store policies allow monetization, but developers still need to market responsibly and handle permissions and user data carefully.[cite:10] Subscription logic and payment orchestration are commonly handled outside the store through the developer’s own backend and billing system.[cite:17]

## Parsing Strategy

Do not attempt universal parsing on day one. Start with one broker page type and one or two strategy templates.

### v1 supported flows
- Covered call order page
- Cash-secured put order page

### extraction priority
1. Read structured DOM labels first.
2. Fall back to table cell pattern matching.
3. Fall back to user confirmation UI if a field is ambiguous.

### broker rollout order
1. Fidelity
2. Robinhood
3. Webull
4. Schwab or E*TRADE later

Keep parser logic isolated by broker:

```text
extension/parsers/
├─ fidelity.js
├─ robinhood.js
├─ webull.js
└─ common.js
```

## Security and Privacy

The extension should request only the minimum host permissions necessary for supported sites and should disclose what data is accessed and why.[cite:11][cite:12] Chrome privacy guidance emphasizes minimizing collection, limiting use to the disclosed purpose, and handling user data securely.[cite:11][cite:12][cite:13]

### rules
- Do not capture whole-page content unless needed.
- Do not store raw brokerage page HTML server-side.
- Hash URLs before long-term storage when practical.
- Do not persist tokens in unsafe page context.
- Do not ask for broad `<all_urls>` permission for v1.
- Separate page-readable data from account/billing data.

## Compliance Positioning

Use language such as:
- educational explanation
- payoff analysis
- risk summary
- strategy interpretation

Avoid language such as:
- buy this now
- best trade today
- guaranteed win
- market-beating signal

This product should help users understand a visible options setup, not generate personalized investment recommendations.

## Local Development Stack

### docker-compose services

```yaml
services:
  api:
    build: ./api
    env_file:
      - ./infra/env/api.env
    ports:
      - "5000:5000"
    depends_on:
      - db
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: optionlens
      POSTGRES_USER: optionlens
      POSTGRES_PASSWORD: optionlens_dev
    ports:
      - "5432:5432"
```

### local config approach
- `FLASK_ENV=development`
- `DATABASE_URL=sqlite:///optionlens.db` for quick solo dev
- `DATABASE_URL=postgresql+psycopg://...` for shared or production-like testing
- `STRIPE_SECRET_KEY=...`
- `STRIPE_WEBHOOK_SECRET=...`
- `JWT_SECRET_KEY=...`

## Release Phases

### Phase 1: MVP
- One broker
- Two strategies
- Rule-based calculations
- Free tier only or manual beta access
- No historical dashboard

### Phase 2: Paid beta
- Stripe subscription
- Usage metering
- Explanation history
- Side panel polish
- Two or three brokers

### Phase 3: Scale
- Additional strategies
- AI-enhanced explanation layer
- Web dashboard
- Saved preferences
- Broker-specific parser telemetry

## Build Order

1. Build the extension parser for one broker.
2. Add a local calculator that works without the backend.
3. Add the Flask `/api/analysis/explain` endpoint.
4. Add auth.
5. Add usage tracking.
6. Add Stripe checkout and webhook sync.
7. Add plan gating in the extension UI.

This order reduces risk because the hardest product assumption is whether users value the in-page explanation enough to install and keep using the extension. Billing should come after parser accuracy and explanation clarity are already working.

## Tech Decisions

| Area | Recommendation | Reason |
|---|---|---|
| Primary UX | Chrome/Edge extension | In-page context is the main value.[cite:31][cite:36] |
| Backend | Flask | Fastest fit with Python workflow and Docker familiarity.[cite:25] |
| Billing | Stripe | Standard recurring billing and webhook model |
| Database | PostgreSQL in prod, SQLite in dev | Clean upgrade path with simple local setup |
| Auth | Magic link or JWT-based session API | Lower friction for extension login |
| AI | Optional after MVP | Parser/calculator should work first |

## Non-Goals for v1

- Full brokerage integration via private APIs
- Autotrading
- Portfolio syncing
- Open-ended AI chat
- Social trading feed
- Multi-leg spread optimization

## Definition of Done for MVP

The MVP is complete when a user can install the extension, open a supported options page, click analyze, receive a correct plain-English explanation, see key payoff numbers, and hit a usage/paywall boundary that is enforced by the backend rather than only by the client.
