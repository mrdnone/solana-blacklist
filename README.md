<div align="center">

# Solana Blacklist Explorer

**Validator trust intelligence for the Solana ecosystem**

[![Built with Rust](https://img.shields.io/badge/Built%20with-Rust-orange?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![Live](https://img.shields.io/badge/Live-solana.mrdn.one-brightgreen?style=flat-square)](https://solana.mrdn.one/blacklist/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)

</div>

---

Validator risk data on Solana is fragmented. Different organizations publish their own lists. Context is inconsistent. Historical visibility is weak. Community signals are hard to interpret.

**Solana Blacklist Explorer** turns that noise into one clear interface — a place where operators, researchers, and delegators can understand who is being flagged, why, and how that status changes over time.

---

## Features

| | |
|---|---|
| **Multi-Source Aggregation** | Pulls from Jito, Hanabi, sandwiched.me, and Solana SFDP — deduplicated and normalized into one view. |
| **Validator Profiles** | Go beyond a raw pubkey. See blacklist status, metadata, and historical epoch activity in a single place. |
| **Epoch Snapshots** | Trust isn't static. Browse epoch-level history to spot patterns and track how validators appear over time. |
| **Source Transparency** | Every flag stays linked to its origin. Know who raised it and weigh signals accordingly. |
| **Meridian Community Reporting** | Validators can submit signed, verifiable reports — turning community signals into structured intelligence. |
| **Public API + Swagger Docs** | Full REST API for building integrations, screening tools, or internal dashboards. |

---

## Live Demo

> **[solana.mrdn.one/blacklist](https://solana.mrdn.one/blacklist/)** — explore the live product
>
> **[solana.mrdn.one/docs](https://solana.mrdn.one/docs)** — interactive API documentation

---

## Quick Start

The full stack — API, frontend, and background collector — runs in a single Docker command.

```bash
cp .env.example .env
docker compose up -d --build
```

Open **[http://127.0.0.1:3000/blacklist/](http://127.0.0.1:3000/blacklist/)** in your browser.

API docs are at **[http://127.0.0.1:3000/docs](http://127.0.0.1:3000/docs)**.

```bash
# Stop the stack
docker compose down
```

---

## Who This Is For

**Staking operators** — get a clearer trust and exclusion workflow before delegating stake.

**Validator researchers** — track suspicious behavior, source overlap, and historical patterns in one place.

**Delegators** — inspect a validator's risk signals before committing stake.

**Infrastructure teams** — build internal screening, monitoring, or trust tooling on top of the API.

---

## Development

### Backend

```bash
cargo run --bin api
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
# → http://localhost:5173/blacklist/
```

Run the test suite:

```bash
cargo test                                      # unit tests (no network)
cargo test -- --ignored --nocapture             # integration tests (requires network)
```

---

## Configuration

| Variable | Description |
|---|---|
| `SOLANA_RPC_URL` | Solana RPC endpoint for validator data |
| `BLACKLIST_REFRESH_SECS` | How often blacklist sources are re-fetched |
| `BLACKLIST_FILTER_INACTIVE` | Filter out delinquent or inactive validators |
| `ADMIN_KEY` | Enables moderated admin endpoints |

Copy `.env.example` and adjust as needed.

---

## Deployment

The production setup uses Docker, nginx, and systemd.

```bash
# Deploy from your machine to a VPS
./deploy/deploy.sh user@your-server-ip

# Update on the server
./deploy/update.sh
```

---

## Stack

- **Rust 2024** — Axum, Tokio, Rusqlite (SQLite), Reqwest, ed25519-dalek
- **React 19 + TypeScript** — Vite 8, Tailwind CSS 4, React Router 7
- **SQLite WAL** — lightweight persistence with no external database dependency
- **Docker multi-stage** — single image ships both the API and the compiled frontend

---

## License

Released under the [MIT License](LICENSE). Copyright © 2026 Meridian.