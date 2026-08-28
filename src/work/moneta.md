---
layout: case-study.njk
tags: work
title: "Moneta — a personal finance platform **I actually trust**"
context: "Self-hosted · FastAPI · DuckDB · React 19 · Rust · NAS · 2023–present"
order: 4
description: "A self-hosted personal finance platform built because the alternatives either died, cost money while owning your data, or did the math wrong. 7,000+ transactions, 3 years of history, running on home infrastructure."
tldr: "Every personal-finance app I tried either shut down, charged me to hold my own data, or got the math wrong. So I built my own: self-hosted, 7,000+ transactions, three years of history, running on my NAS — and I actually trust the numbers."
stats:
  - { n: "7,000+", label: "transactions processed" }
  - { n: "6", label: "brokerage accounts" }
  - { n: "25+", label: "bank / card / loan accounts" }
  - { n: "7s → 15ms", label: "data load, after the perf overhaul" }
---

## What is Moneta?

Moneta is a self-hosted personal finance platform — a full replacement for Mint, Monarch, and Origin — that runs entirely on home infrastructure. It tracks spending, investments, and net worth across six brokerage accounts and over 25 bank, credit card, and loan accounts, applies institutional-grade performance mathematics, and projects long-term financial outcomes using Monte Carlo simulation. Every transaction, every holding, every calculation lives on a Terramaster NAS. No subscription. No third-party cloud. No data-sharing agreement buried in a terms-of-service page.

It started as a simple question: why do personal finance tools either die (Mint), charge a monthly fee to store your most sensitive data in someone else's cloud (Monarch, Origin), or produce performance numbers that are subtly wrong? The answer is that building it correctly is hard, and most products take shortcuts. Moneta doesn't.

## Why build it?

Three reasons, in order of weight.

**The data ownership problem.** Financial transaction history is among the most sensitive data a person generates. The aggregator model — connecting your bank accounts to a third-party service — means your spending patterns, account balances, and investment holdings live on servers you don't control, monetised in ways you can't fully audit. Local-first is not a preference here; it's the only architecture that makes sense for this class of data.

**The performance math problem.** Most personal finance apps show "return" as a simple percentage change in account value. This is wrong the moment you make a contribution or withdrawal, which is constantly. The correct metrics — Time-Weighted Return (TWR), Money-Weighted Return (MWR), Sharpe ratio, maximum drawdown — account for cash flows properly and let you compare your performance against benchmarks fairly. Moneta computes all of them. This matters because the difference between TWR and a naive return calculation can be several percentage points — enough to give you a fundamentally wrong picture of how your portfolio is performing.

**The projection problem.** Existing tools that offer financial projections use linear extrapolation — a straight line from today to retirement. Real financial outcomes aren't linear. Moneta's projection engine uses Monte Carlo simulation with geometric Brownian motion, block bootstrap resampling, and regime-switching to model the actual distribution of possible outcomes. It also includes a full 2026 federal and Pennsylvania tax engine, a Roth conversion ladder optimizer, and an asset location linear program that helps decide which assets belong in which account types.

## Architecture

Moneta is built in three layers that each do one thing well.

<div class="arch-diagram">
<canvas id="monetaCanvas" height="480"></canvas>
<div class="arch-caption">Hover over any node to learn what it does. Data flows left to right — sources into the core, results into the dashboard.</div>
</div>
<script src="/js/moneta-animation.js"></script>

**Data layer — DuckDB.** Transaction history, holdings snapshots, price series, and computed metrics all live in DuckDB — an embedded analytical database that runs in-process, needs no server, and handles the columnar queries that performance attribution requires at native speed. Three years of transaction history, six brokerage accounts, and 25+ bank and credit card accounts fit comfortably and query in milliseconds.

**API layer — FastAPI + Rust gateway.** A FastAPI backend handles business logic, performance calculations, and projection runs. The SanthoshIAS Rust gateway sits in front of market data — routing requests across multiple providers (Alpaca, yfinance, FRED) with priority-chain failover. The same DataResolver pattern used in the gateway is the same integration architecture used in institutional systems; Moneta is where it gets pressure-tested at personal scale.

**Frontend — React 19 + d3-sankey.** The dashboard is a composable widget system built in React 19 with dnd-kit for drag-and-drop layout. The cashflow visualisation uses d3-sankey to render Sankey diagrams — income flowing into spending categories, investments, and savings — server-rendered in FastAPI and painted in the browser. Widget registry entries map to small, medium, and large layout variants, designed to match WidgetKit systemSmall/Medium/Large for a planned native iOS/iPadOS/macOS companion app.

**Data sources — SimpleFIN Bridge + SEC EDGAR.** Bank and brokerage transaction data arrives via SimpleFIN Bridge, which avoids screen-scraping by connecting directly to financial institution APIs. Holdings data includes an SEC EDGAR N-PORT parser that pulls institutional fund holdings directly from regulatory filings — the same data mutual fund managers are required to disclose quarterly.

## Performance — a seven-second load, traced to first principles

Every page took roughly seven seconds on a hard refresh before the data appeared. The database wasn't the problem — a direct query answered in eight milliseconds. The API wasn't the problem — through the local proxy it was still seventeen. But the browser, requesting the same endpoint with the same data on a hard refresh, waited **7,600 milliseconds**.

I found it by measuring the same request at three points in the stack rather than guessing:

| Path | Cold | Warm |
|---|---|---|
| Direct to the API | 8&nbsp;ms | &lt;2&nbsp;ms |
| Through the dev proxy | 17&nbsp;ms | &lt;2&nbsp;ms |
| Browser, hard refresh | **7,600&nbsp;ms** | &lt;2&nbsp;ms |

The 450× gap between the proxy and the browser pointed at one mechanism: **HTTP/1.1 connection saturation.** A browser opens at most six connections per origin. On a hard refresh one was held permanently by the live-updates stream (Server-Sent Events), and the other five were consumed downloading 200-plus JavaScript chunks. The API calls the frontend needed on mount had no slot — they queued behind the chunk downloads in the dev server's single event loop, even though the API was answering in milliseconds the whole time.

Local development hides this. In production, static files come from a CDN and the API sits on its own domain; they never compete for the same connection pool. Running the whole stack in one process on one machine collapses that separation, and the contention only shows up under the load of a cold start.

**Five fixes, across four layers:**

**Connection lifecycle.** The live-updates stream now opens on `window.load`, after the critical resources are down — freeing all six connection slots during the render path. Time to a usable DOM dropped from 37 seconds to 0.6.

**Render lifecycle.** The server-rendered default didn't match the interface every user actually sees after the page hydrates, so each load mounted one dashboard, switched, and re-mounted another — firing 22 API calls instead of 10. Aligning the server default with the post-hydration state halved that.

**Transport.** API calls now go straight to the backend instead of through the frontend's rewrite proxy, so they no longer queue behind static-file serving in the same event loop. Browser response times: 7,600 ms → 4–22 ms.

**Caching.** A small in-process cache in front of the eight heaviest endpoints, with **write-through invalidation** — any mutation that changes the data clears the cache covering it, so recategorising a transaction shows the corrected number immediately, not whenever a timer lapses. Warm responses: 100–500 ms → under 2 ms.

**Storage.** The monthly cashflow aggregates — income, expenses, per-category breakdown — moved from read-time computation to a materialised table recomputed on write. A twelve-month summary that used to scan the full transaction table (27 ms, and growing linearly with every year of history) is now a handful of primary-key lookups (1.9 ms, flat regardless of data volume).

The thread through all five: **work that happens on every read should be paid once, on write.** Reads are constant — every page load, every widget. Writes are rare — one sync a day, the occasional manual edit. Anything you can shift from the first to the second is close to free.

## Unique features

**AI fund alternatives engine.** Given a current holding, Moneta scores potential replacements across expense ratio, tracking error, tax efficiency, liquidity, and factor exposure — producing a composite score and a ranked shortlist. An example: FDGRX (Fidelity Growth Company) scores at 82/100 for a swap to SCHG (Schwab US Large Cap Growth ETF), primarily driven by the expense ratio differential and superior tax efficiency. This isn't a recommendation engine — it's a structured comparison that makes the trade-off explicit.

**Moneta Horizon — projection engine.** The long-term projection module models retirement outcomes using three simulation methods: geometric Brownian motion for baseline, block bootstrap resampling to preserve autocorrelation in historical returns, and regime-switching to model bull/bear market transitions. The output is a probability distribution of outcomes — not a line, a fan. The full 2026 MFJ federal and Pennsylvania tax engine means projections account for actual tax drag at each income bracket, including Social Security taxation thresholds and Medicare IRMAA surcharges.

**Roth conversion optimizer.** Given current traditional and Roth balances, expected income, and a retirement horizon, the optimizer models multi-year Roth conversion ladders to minimise lifetime tax burden — accounting for bracket management, RMD pressure, and the step-up-in-basis benefit of Roth assets for heirs.

**Asset location linear program.** A linear programming model that determines which assets should live in which account types (taxable, traditional, Roth) to minimise after-tax returns — placing tax-inefficient assets (bonds, REITs) in tax-advantaged accounts and tax-efficient assets (index ETFs) in taxable accounts.

**Rent-vs-buy model.** A detailed rent-vs-buy analysis for the Wexford, PA market — modelling mortgage payments, property tax, maintenance, opportunity cost of down payment, and local appreciation rates against current rent — concluding that buying is substantially more expensive than renting under baseline assumptions in the current rate environment.

**LifeOS integration.** Moneta sits alongside LifeOS — a 12-module credential and account reference layer running on the same NAS, encrypted with AES-256-GCM, seeded from an Origin CSV export. LifeOS tracks account numbers, login credentials, benefit summaries, and insurance policies. Together they form a complete financial operating system for a household.

## What it signals

Moneta exists because I wanted it to exist — and that's the point. The same instincts that produced the wire automation platform at work (evaluate the right architecture, build what's warranted, own the result) operate at home. The technology is different, the scale is personal, and the stakes are real.

A financial professional who builds their own financial infrastructure because the existing tools aren't good enough is telling you something. Moneta is that statement in code.

---

*Demo available on request. Architecture walkthrough and code available for technical conversations.*
