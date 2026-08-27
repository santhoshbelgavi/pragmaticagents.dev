---
layout: case-study.njk
tags: work
title: "APEX / AlphaEdge — an options trading platform built like a production system"
context: "Personal infrastructure · React 19 · FastAPI · Rust · DuckDB · v11 · 2023–present"
order: 7
description: "An options analytics and automated trading platform, now at v11. Bayesian expectancy, per-symbol state machines, market-character classification, and a five-layer safety architecture — engineered to production standards because the consequences are real."
stats:
  - { n: "v11", label: "current version" }
  - { n: "5-layer", label: "safety architecture" }
  - { n: "Bayesian", label: "expectancy engine" }
  - { n: "$86K+", label: "paper losses diagnosed & fixed" }
---

## What is APEX?

APEX (AlphaEdge) is a self-built options analytics and semi-automated trading platform. It ingests real-time market data, classifies market conditions, selects strikes using an Expected Move framework, scores signals through a Bayesian expectancy engine, and manages positions via per-symbol state machines with a five-layer safety architecture. The frontend is a React 19/TypeScript/Vite SPA served at port 5175. FastAPI handles the backend at port 8010, SanthoshIAS routes market data at port 7700, and DuckDB stores everything.

It is v11. Each version is a response to something that went wrong — systematically diagnosed, root-caused, and fixed.

## Why build it?

Most retail options platforms are built for the median trader. The median trader wants a simple P&L view, a basic scanner, and a one-click order ticket. That's fine for the median trader. It's not fine for someone who wants to model expectancy across market regimes, run cross-sectional z-score composites on volatility surface changes, or implement a Roth conversion optimizer on the same stack that manages live positions.

The existing tools also don't let you audit their logic. When a signal fires and the trade loses, a black-box platform gives you nothing to learn from. APEX gives you the full attribution stack — which gate failed, which regime misclassified, which exit rule triggered too early or too late. That feedback loop is the point.

## What went wrong and what was fixed

APEX v10 ran a paper trading account. The postmortem identified two root causes of significant losses.

**The naked-short bug.** 24 illegal sell-to-open orders were executed on positions that weren't open, causing forced assignments. The estimated impact was approximately $21K in paper losses. Root cause: the position-state check was reading stale data from a cache that wasn't invalidated on fill. Three protection layers were implemented: a close-intent gate that validates position state before order submission, an HTTP 422 rejection at the order endpoint for any order that would create a net-short position in an account not approved for naked short selling, and a startup assertion that refuses to initialise if position state cannot be verified.

**The give-back problem.** 73% of stopped trades peaked profitably before reversing — approximately $65K in unrealized gains surrendered to stop-outs. Root cause: the exit architecture was a single trailing stop with no regime awareness. A position in a trending market and a position in a mean-reverting market need different exit logic. v11's exit architecture has four components: a break-even mover that locks in basis once a position reaches a threshold, a regime-change exit that closes positions when the market character classifier signals a regime shift, a theta manager that accelerates exits as expiration approaches and theta burn accelerates, and a tranche policy that allows partial exits at different profit targets.

## v11 Architecture

<div class="arch-diagram">
<canvas id="apexCanvas" height="420"></canvas>
<div class="arch-caption">Five-layer safety architecture ensures no order reaches the market without passing every gate. Hover any node for detail.</div>
</div>
<script src="/js/apex-animation.js"></script>

**Strike Selection V2.** Replaced static percentage-based strike distances with Expected Move units derived from ATM straddle mids. Each candidate strike is scored on a composite of liquidity, IV rank, expected move coverage, and regime fit. Four regime presets — PINNED, TRANSITIONAL, AMPLIFIED, DEFENSIVE — adjust the composite weights. The portfolio risk envelope scales with equity, conviction score, IVR, and heat caps.

**Volatility Expansion Scanner (VES).** A cross-sectional z-score composite that replaces a flawed multiplicative formula. GEX (gamma exposure) is oriented as a signed signal — negative GEX means dealers are short gamma and moves are amplified. A K-of-N conviction gate requires signal agreement across a minimum number of inputs before routing to the strategy classifier, which outputs one of LONG\_PREMIUM, SHORT\_PREMIUM, GAMMA\_MOMENTUM, or WATCH.

**Bayesian expectancy engine.** Rather than a simple win-rate and average-win calculation, the expectancy engine updates prior beliefs about strategy performance as new trades settle — adjusting for market regime, IV environment, and time-of-day. Strategies that performed well in trending markets are down-weighted in mean-reverting regimes. The engine informs position sizing through a Kelly-adjacent formula with a conservative fractional multiplier.

**Per-symbol state machines.** Each symbol under management runs a state machine — IDLE, SCANNING, ENTERED, MANAGING, EXITING — with explicit transitions and guards. No order can be submitted unless the state machine is in a valid state for that order type. This is the architectural response to the naked-short bug: position state is a first-class concept in the system, not an afterthought.

## What it saves

**Directly:** APEX runs in paper mode before any live deployment. Every strategy failure costs paper dollars, not real ones. The $86K+ in diagnosed paper losses represents systematic failures that were caught, root-caused, and fixed before touching a live account. That's the purpose.

**More importantly:** APEX is where quantitative ideas meet production-engineering standards. The same discipline — five-layer safety, state machines, Bayesian attribution — is what makes the wire automation platform reliable at $400B+ in volume. One is personal; the other is institutional. The engineering philosophy is identical.
