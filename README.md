# Longitudinal Health & Nutrition Review Agent

A stateful wellness application built using the full-stack architecture of **React (Vite) + Node.js (Express) + SQLite** with secure server-side **Gemini API** integration.

This application provides a highly polished, responsive dark-mode portal enabling users to log wellness metrics (sleep, activity, weight, energy, mood, meals), perform RAG-based AI wellness reviews, approve versioned active plans, and explore system audit logs.

---

## 🛠️ Technology Stack

* **Frontend**: React (Vite), Vanilla CSS (Glassmorphism & dark-mode custom properties), Lucide Icons, and custom responsive SVG Charts (no bloated charting libraries).
* **Backend**: Node.js, Express.js (REST API, CORS config, and static production assets serving).
* **Database**: SQLite (`database.sqlite` file-based database) with relational schemas and native JSON column parsing.
* **AI Integration**: Official Google `@google/generative-ai` SDK communicating securely from the backend to the **Gemini 1.5/2.0 Flash** models.
* **AI Fallback**: Local Heuristic Parser utilizing regex and a 200 Indian/American food dictionary, ensuring the app is 100% functional even offline.

---

## 🚀 Getting Started

### 📋 Prerequisites
* Node.js (version 18 or above recommended)
* npm (Node Package Manager)

### ⚙️ Quick Installation
Install all root, client, and server dependencies with the bootstrap script:

```bash
npm run install:all
```

*Or install manual prefixes:*
```bash
npm install
npm install --prefix client
npm install --prefix server
```

### 🔑 Configuration (.env)
1. Navigate to the `/server` directory.
2. Copy the environment template:
   ```bash
   cp .env.example .env
   ```
3. Set your custom port and optional Google Gemini API Key:
   ```env
   PORT=5000
   NODE_ENV=development
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   *Note: If no Gemini key is provided, the backend seamlessly switches to the **Heuristic AI Simulator** mode so the app never breaks.*

### 🏃 Running Locally
Start both the React client dev server (port 5173) and the Express backend server (port 5000) simultaneously:

```bash
npm run dev
```

Open your browser and navigate to: **`http://localhost:5173`**

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│               React Frontend Client (SPA)              │
│ - Auth, Dashboard, Data Logger, AI reviews, Goals, Logs │
│ - Client-side state-based routing & SVG charting       │
└──────────────────────────┬─────────────────────────────┘
                           │ API Calls (Proxied via Vite)
                           ▼
┌────────────────────────────────────────────────────────┐
│               Node.js Express Backend API              │
│ - Auth & Session controllers                           │
│ - Daily Logs validation & averages calculator          │
│ - AI Agent Services (RAG search, Heuristic Simulator)  │
└──────────────────────────┬─────────────────────────────┘
                           │ Loads Server-side .env
                           ├─────────────────────────────┐
                           ▼                             ▼
              ┌──────────────────────────┐   ┌───────────────────────┐
              │ Gemini API (Server Side) │   │ SQLite File Database  │
              │ - Live LLM Workflows     │   │ - data/database.db    │
              └──────────────────────────┘   └───────────────────────┘
```

---

## 🗃️ Database Schema

The SQLite database (`server/data/database.sqlite`) maintains relational integrity using the following schemas:

* **`users`**: Stored accounts credentials (SHA-256 password hash, DOB, biological sex).
* **`daily_logs`**: Chronological records of numerical metrics (date, weight, sleepHours, mood, energy).
* **`meals`**: Unstructured meal texts alongside AI estimates and user corrections.
* **`activities`**: Logged workouts (duration, intensity, category).
* **`goals`**: Versioned health goals (target sleep, daily calories, activity minutes).
* **`plans`**: Versioned wellness plans proposed by the AI reviewer (Active, Pending, Rejected, Superseded).
* **`audit_logs`**: System logs tracking user overrides, rejections, AI uncertainty, and failures.

---

## 🧪 Running Automated Tests

Run the test suite verifying deterministic averages calculations and bounds check validators:

```bash
npm run test --prefix server
```

*(Or navigate to `/server` and run `npm test` once dependencies are installed).*

---

## 🌍 Production Build & Deployment

In production, the React SPA is compiled and compiled inside the Express backend to run as a single process:

1. Compile the React assets:
   ```bash
   npm run build:client
   ```
2. The compiled files are bundled into `client/dist/`.
3. In production (`NODE_ENV=production`), the Express server automatically serves `client/dist/` as static assets.
4. Deploy the entire directory to a public cloud platform (e.g., Render, Fly.io, Heroku) and set the `GEMINI_API_KEY` in your cloud console variables.
