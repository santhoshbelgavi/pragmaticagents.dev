---
layout: case-study.njk
tags: work
title: "FlowDeck — replacing a paid options-flow SaaS with 800 lines of Rust"
context: "Personal infrastructure · Rust · flowengine crate · NAS · 2024–present"
order: 3
description: "The build-when-warranted philosophy applied at home. A paid options-flow analytics subscription cancelled, replaced with a purpose-built Rust platform that does more, costs nothing monthly, and runs on infrastructure I already own."
tldr: "I cancelled a paid options-flow analytics subscription and replaced it with roughly 800 lines of Rust running on hardware I already own. It does more than the SaaS did, costs nothing monthly, and every test is green."
stats:
  - { n: "~800", label: "lines of Rust at the core" }
  - { n: "$0/mo", label: "vs paid SaaS subscription" }
  - { n: "27", label: "tests green, compile-verified" }
  - { n: "Self-hosted", label: "on home NAS" }
---

## What is FlowDeck?

FlowDeck is a self-hosted options-flow analytics platform. It ingests live options trade data, classifies each trade by type and intent, scores composite signals using z-score normalization, and surfaces unusual activity through a seven-tab SPA dashboard. The core is a Rust crate called `flowengine` — roughly 800 lines of compile-verified logic that does what the SaaS did, plus things the SaaS couldn't.

It runs on a Terramaster NAS alongside Moneta, SanthoshIAS, and APEX — one stack, one infrastructure bill, zero monthly subscriptions for this layer.

## Why?

I was paying for Bullflow, a flow-analytics SaaS that surfaces unusual options activity. It was fine. But three things bothered me enough to act.

**Opacity.** The scoring was a black box. I could see the output — unusual flow flagged, sweep or block categorised, sentiment labelled — but I couldn't read the logic. When a signal was wrong, I had no path to understanding why.

**Rigidity.** The filters were fixed. I wanted screens that matched my specific trading framework — z-score composites weighted by my conviction model, not someone else's generic definitions of "unusual." A SaaS serves the median user. The median user is not me.

**Dependency.** The data was flowing through SanthoshIAS already — ThetaData, QuantData, DXLink licensed feeds. The vendor's value-add was a UI over analysis I understood better than the product description did. I was renting a dashboard on top of data I already owned the pipeline for.

The build case was earned. The vendor case wasn't.

## What I built

**The flowengine crate.** The Rust core: a live trade classifier that categorises each print (sweep, block, split, repeat), a z-score composite scorer that normalises signal strength across tickers and expirations, and a JSON filter DSL so new screens are configuration rather than code changes. 27 tests, all green. Compile-verified correctness where it counts.

**The dashboard.** A seven-tab SPA served by the same FastAPI layer used across the stack. Tabs cover live flow, composite scores, unusual activity, position-level aggregates, historical replay, and scanner configuration. The scanner configuration tab is where the DSL lives — add a new filter, save, reload, done. No deployment.

**WebSocket replay.** The `flowengine` crate includes a replay engine that can replay stored WebSocket sessions — useful for backtesting filter logic against real historical flow without re-subscribing.

**One engineering note.** During development, a `DashMap` self-deadlock bug surfaced when two concurrent readers tried to upgrade to write locks on the same key. Caught in testing, fixed before it reached the dashboard. This is exactly the class of concurrency bug that Rust's ownership model makes easier to find but doesn't eliminate entirely — it required explicit lock ordering discipline, not a language guarantee.

## Architecture

<div class="arch-diagram">
<canvas id="flowdeckCanvas" height="380"></canvas>
<div class="arch-caption">Data flows left to right — licensed feeds into the flowengine core, results to dashboard tabs and APEX integration.</div>
</div>
<script src="/js/flowdeck-animation.js"></script>

## What it saves

**Directly:** the monthly Bullflow subscription, cancelled. Every month forward costs nothing for this layer.

**More importantly:** full control of the scoring logic. When a composite signal fires and I'm right, I know why. When it fires and I'm wrong, I can diagnose the failure mode and adjust the weights. That feedback loop — which the SaaS made impossible — is the actual value.

## Why this generalises

This is the same judgment call I bring to a wire automation platform or a fund-accounting build, applied at personal scale. The question is never build-vs-buy as ideology. It's: what do you already own, what is the vendor actually providing, and does the math work? Here the data was already flowing, the logic was understandable, and the SaaS was selling a UI over analysis I could write better. 800 lines of Rust was the correct answer for this situation. A different situation warrants a different answer.
