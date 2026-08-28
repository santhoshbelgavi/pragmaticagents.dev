---
layout: case-study.njk
tags: work
title: "Moneta — a personal finance platform **I actually trust**"
context: "Local-only · TypeScript monorepo · Next.js 14 · Hono · SQLite · 2023–present"
order: 4
description: "A self-hosted personal finance platform built because the alternatives either died, cost money while owning your data, or did the math wrong. 7,000+ transactions, 3 years of history, running on a Mac at home."
tldr: "Every personal-finance app I tried either shut down, charged me to hold my own data, or got the math wrong. So I built my own: local-only, 7,000+ transactions, three years of history, running on a Mac at home — and I actually trust the numbers."
stats:
  - { n: "7,000+", label: "transactions processed" }
  - { n: "6", label: "brokerage accounts" }
  - { n: "25+", label: "bank / card / loan accounts" }
  - { n: "7s → 15ms", label: "data load, after the perf overhaul" }
---

## What is Moneta?

Moneta is a self-hosted personal finance platform — a full replacement for Mint, Monarch, and Origin — that runs entirely on home infrastructure. It tracks spending, investments, and net worth across six brokerage accounts and over 25 bank, credit card, and loan accounts, applies institutional-grade performance mathematics, and projects long-term financial outcomes using Monte Carlo simulation. Every transaction, every holding, every calculation lives in a single SQLite file on a Mac at home. No subscription. No third-party cloud. No data-sharing agreement buried in a terms-of-service page.

It started as a simple question: why do personal finance tools either die (Mint), charge a monthly fee to store your most sensitive data in someone else's cloud (Monarch, Origin), or produce performance numbers that are subtly wrong? The answer is that building it correctly is hard, and most products take shortcuts. Moneta doesn't.

## Why build it?

Three reasons, in order of weight.

**The data ownership problem.** Financial transaction history is among the most sensitive data a person generates. The aggregator model — connecting your bank accounts to a third-party service — means your spending patterns, account balances, and investment holdings live on servers you don't control, monetised in ways you can't fully audit. Local-first is not a preference here; it's the only architecture that makes sense for this class of data.

**The performance math problem.** Most personal finance apps show "return" as a simple percentage change in account value. This is wrong the moment you make a contribution or withdrawal, which is constantly. The correct metrics — Time-Weighted Return (TWR), Money-Weighted Return (MWR), Sharpe ratio, maximum drawdown — account for cash flows properly and let you compare your performance against benchmarks fairly. Moneta computes all of them. This matters because the difference between TWR and a naive return calculation can be several percentage points — enough to give you a fundamentally wrong picture of how your portfolio is performing.

**The projection problem.** Existing tools that offer financial projections use linear extrapolation — a straight line from today to retirement. Real financial outcomes aren't linear. Moneta's projection engine uses Monte Carlo simulation with geometric Brownian motion, block bootstrap resampling, and regime-switching to model the actual distribution of possible outcomes. It also includes a full 2026 federal and Pennsylvania tax engine, a Roth conversion ladder optimizer, and an asset location linear program that helps decide which assets belong in which account types.

## Architecture

Moneta is one pnpm monorepo, three packages, TypeScript in strict mode throughout: **`@moneta/web`** (the Next.js frontend), **`@moneta/api`** (the Hono service), and **`@moneta/db`** (the SQLite schema). No cloud, no Docker, no Kubernetes — the whole thing runs on a Mac at home, supervised by launchd as two separate agents.

<div class="arch-diagram">
<canvas id="monetaCanvas" height="480"></canvas>
<div class="arch-caption">Hover over any node to learn what it does. Data flows left to right — sources into the store, results into the dashboard.</div>
</div>
<script src="/js/moneta-animation.js"></script>

**Data layer — SQLite + Drizzle.** Every transaction, holding snapshot, price point, and computed metric lives in a single SQLite file, accessed through better-sqlite3 with Drizzle ORM for type-safe schema and queries. WAL mode, a 64 MB page cache, foreign keys enforced. Fifteen tables — two of them (`networth_cache`, `cashflow_monthly_cache`) are manually-maintained materialised views, recomputed on write so the dashboard's heaviest reads become primary-key lookups. Three years of history and 25+ accounts fit in a file you can copy, and queries return in milliseconds.

**API layer — Hono.** A Hono service — a lightweight TypeScript HTTP framework, in the same family as Express or Fastify — runs on `@hono/node-server` and handles the business logic: performance mathematics, projection runs, the transaction-categorisation cascade, and the read endpoints the dashboard hits on every load. In front of the heaviest of those sits an in-process, Map-based TTL cache with write-through invalidation — no Redis, because a single process on localhost gains nothing from a network hop. Sync progress streams to the browser over Server-Sent Events.

**Frontend — Next.js 14 + React 18.** The App Router, served in production via `next start`. TanStack Query manages data fetching and the client-side cache; Tailwind and shadcn/ui handle styling. The dashboard is a composable widget system with dnd-kit drag-and-drop — each widget maps to small, medium, and large layout variants, sized to match WidgetKit's systemSmall/Medium/Large for a planned native iOS/iPadOS/macOS companion app. The cashflow view renders the month as a Sankey diagram.

**Categorisation — local ML, nothing leaves the machine.** New transactions run a three-stage cascade: deterministic rules first; then a MiniLM sentence-embedding model (via `@xenova/transformers`, in-process) that matches an unfamiliar merchant against previously-categorised ones by vector similarity; and finally a local Gemma model through Ollama for anything still unresolved. No external AI API, no transaction text sent anywhere.

**Data sources.** Bank, card, and loan transactions arrive through SimpleFIN Bridge, with Plaid added recently for institutions SimpleFIN doesn't reach — both connect to financial-institution APIs directly rather than screen-scraping. Investment accounts come from Interactive Brokers Flex Queries (scheduled XML exports) and the Tastytrade API. A CSV inbox catches anything the connectors can't. Market quotes for held positions route through [SanthoshIAS](/work/santhoshias/), the small provider-routing layer shared across my stack.

## Performance — a seven-second load, traced to first principles

Every page took roughly seven seconds on a hard refresh before the data appeared. SQLite wasn't the problem — a direct query answered in eight milliseconds. The Hono API wasn't the problem — through the Next.js proxy it was still only seventeen. But the browser, requesting the same endpoint with the same data on a hard refresh, waited **7,600 milliseconds**.

I found it by measuring the same request at three points in the stack rather than guessing:

| Path | Cold | Warm |
|---|---|---|
| Direct to the Hono API | 8&nbsp;ms | &lt;2&nbsp;ms |
| Through the Next.js proxy | 17&nbsp;ms | &lt;2&nbsp;ms |
| Browser, hard refresh | **7,600&nbsp;ms** | &lt;2&nbsp;ms |

The 450× gap between the proxy and the browser pointed at one mechanism: **HTTP/1.1 connection saturation.** A browser opens at most six connections per origin. On a hard refresh one was held permanently by the Server-Sent Events stream that carries sync updates, and the other five were consumed downloading 200-plus JavaScript chunks. The API calls React needed on mount had no slot — they queued behind the chunk downloads in Next.js's single Node event loop, even though Hono was answering in milliseconds the whole time.

Local development hides this. In a deployed app, static files come from a CDN and the API sits on its own domain; they never compete for the same connection pool. Running the whole stack in one Node process on one machine collapses that separation, and the contention only shows up under the load of a cold start.

**Five fixes, across four layers:**

**Connection lifecycle.** The Server-Sent Events stream now opens on `window.load`, after the critical resources are down — freeing all six connection slots during the render path. Time to a usable DOM dropped from 37 seconds to 0.6.

**Render lifecycle.** The server-rendered default UI mode didn't match the one every user actually sees after the page hydrates, so each load mounted one dashboard, switched, and re-mounted another — firing 22 API calls instead of 10. Aligning the SSR default with the post-hydration state halved that.

**Transport.** API calls now go straight to Hono instead of through the Next.js rewrite proxy, so they no longer queue behind static-file serving in the same event loop. Browser response times: 7,600 ms → 4–22 ms.

**Caching.** The in-process Map cache in front of the eight heaviest endpoints, with **write-through invalidation** — any mutation that changes the data clears the cache covering it, so recategorising a transaction shows the corrected number immediately, not whenever a timer lapses. Warm responses: 100–500 ms → under 2 ms.

**Storage.** The monthly cashflow aggregates — income, expenses, per-category breakdown — moved from read-time computation into the `cashflow_monthly_cache` table, recomputed on write. A twelve-month summary that used to scan the full transaction table (27 ms, and growing linearly with every year of history) is now a handful of primary-key lookups (1.9 ms, flat regardless of data volume).

The thread through all five: **work that happens on every read should be paid once, on write.** Reads are constant — every page load, every widget. Writes are rare — one sync a day, the occasional manual edit. Anything you can shift from the first to the second is close to free.

## Unique features

**AI fund alternatives engine.** Given a current holding, Moneta scores potential replacements across expense ratio, tracking error, tax efficiency, liquidity, and factor exposure — producing a composite score and a ranked shortlist. An example: FDGRX (Fidelity Growth Company) scores at 82/100 for a swap to SCHG (Schwab US Large Cap Growth ETF), primarily driven by the expense ratio differential and superior tax efficiency. This isn't a recommendation engine — it's a structured comparison that makes the trade-off explicit.

**Moneta Horizon — projection engine.** The long-term projection module models retirement outcomes using three simulation methods: geometric Brownian motion for baseline, block bootstrap resampling to preserve autocorrelation in historical returns, and regime-switching to model bull/bear market transitions. The output is a probability distribution of outcomes — not a line, a fan. The full 2026 MFJ federal and Pennsylvania tax engine means projections account for actual tax drag at each income bracket, including Social Security taxation thresholds and Medicare IRMAA surcharges.

**Roth conversion optimizer.** Given current traditional and Roth balances, expected income, and a retirement horizon, the optimizer models multi-year Roth conversion ladders to minimise lifetime tax burden — accounting for bracket management, RMD pressure, and the step-up-in-basis benefit of Roth assets for heirs.

**Asset location linear program.** A linear programming model that determines which assets should live in which account types (taxable, traditional, Roth) to minimise after-tax returns — placing tax-inefficient assets (bonds, REITs) in tax-advantaged accounts and tax-efficient assets (index ETFs) in taxable accounts.

**Rent-vs-buy model.** A detailed rent-vs-buy analysis for the Wexford, PA market — modelling mortgage payments, property tax, maintenance, opportunity cost of down payment, and local appreciation rates against current rent — concluding that buying is substantially more expensive than renting under baseline assumptions in the current rate environment.

**LifeOS integration.** Moneta sits alongside LifeOS — a 12-module credential and account reference layer on the same machine, encrypted with AES-256-GCM, seeded from an Origin CSV export. LifeOS tracks account numbers, login credentials, benefit summaries, and insurance policies. Together they form a complete financial operating system for a household.

## What it signals

Moneta exists because I wanted it to exist — and that's the point. The same instincts that produced the wire automation platform at work (evaluate the right architecture, build what's warranted, own the result) operate at home. The technology is different, the scale is personal, and the stakes are real.

A financial professional who builds their own financial infrastructure because the existing tools aren't good enough is telling you something. Moneta is that statement in code.

---

*Demo available on request. Architecture walkthrough and code available for technical conversations.*
