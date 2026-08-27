---
layout: case-study.njk
tags: work
title: "SanthoshIAS — personal Infrastructure-as-a-Service for a multi-app development environment"
context: "Personal infrastructure · Rust · DataResolver · DuckDB · MCP · 2024–present"
order: 5
description: "Built from a simple observation: every app I developed needed the same data providers, and each one was reimplementing the same start/stop, auth, and failover logic independently. SanthoshIAS is the service layer I extracted — one provider, one contract, all apps."
tldr: "Every app I built needed the same data providers, and each one re-implemented its own auth, failover, and start/stop logic. SanthoshIAS is the service layer I extracted — one contract, six providers, all apps. New apps get every provider for free; provider bugs get fixed once, not once per app."
stats:
  - { n: "6", label: "data providers unified" }
  - { n: "3", label: "apps served (Moneta · FlowDeck · APEX)" }
  - { n: "1", label: "endpoint for the whole stack" }
  - { n: "0", label: "duplicate auth logic across apps" }
---

## The origin story

When I started building personal finance and trading apps, I made the same mistake most developers make: each application owned its own data connections.

Moneta talked directly to Alpaca and yfinance. FlowDeck connected directly to ThetaData and QuantData. APEX had its own IBKR and Tastyworks connectors. Each one implemented its own authentication flow, its own session management, its own start/stop lifecycle, its own retry logic, and its own response parsing.

Every time I added a new data provider, I added it to every app that needed it. Every time a provider changed an API, I fixed the bug in every app independently. Every time one provider went down, each app's fallback strategy was different — some graceful, some not.

The pattern was obvious once I saw it clearly: I was building the same infrastructure layer three times over, in three different places, with three different levels of care.

## The insight

The cloud computing model solved this problem at industrial scale decades ago. Infrastructure-as-a-Service providers — AWS, Azure, GCP — abstract the underlying hardware behind a clean API. Consumers don't manage servers; they call a service. The infrastructure complexity is someone else's problem.

The same principle applies at personal development scale. If you have multiple applications that all need the same underlying resources — market data providers, broker connections, macro data feeds — the right answer is a service layer, not repeated per-app integration.

SanthoshIAS is that service layer. The name is literal: **IAS — Infrastructure-as-a-Service**, personal edition. A service provider within my own development environment, run by me, for my apps, giving me the same benefits cloud providers give their customers: consistency, reliability, debuggability, and a single place to fix things when they break.

## What it does

SanthoshIAS presents a single clean API to every consumer in the stack. Every application — Moneta, FlowDeck, APEX — makes calls to SanthoshIAS. SanthoshIAS decides which provider answers, in which order, and what to do when a provider fails.

<div class="arch-diagram">
<canvas id="santhoshiasCanvas" height="380"></canvas>
<div class="arch-caption">Consumers call one endpoint. DataResolver routes to the right provider. Failover is automatic. Hover over any node to see what it does.</div>
</div>
<script src="/js/santhoshias-animation.js"></script>

**The DataResolver.** The core of SanthoshIAS is a priority-chain DataResolver — a Rust struct that holds an ordered list of providers for each data type. When a request arrives, it tries the first provider. If that provider fails, times out, or rate-limits, it falls through to the second. And so on. The consumer never knows which provider answered. The consumer never needs to.

**Six providers, one interface.** ThetaData (options, P1), QuantData (vol surface and flow, P2), DXLink (streaming, P3), Alpaca (equity and paper trading, P4), IBKR (live broker, P5), Tastyworks (options broker, P6). Each provider has a dedicated connector with its own authentication logic, session lifecycle, and response normalisation. That complexity lives in SanthoshIAS, once, not in every app.

**The Tastyworks lesson.** The Tastyworks connector required six separate bug fixes before it worked: a missing `client_id` in the OAuth body, wrong `expires_in` handling, an unconditional refresh loop re-authenticating on every request, per-request client instantiation, a wrong auth header format, and a spurious legacy fallback silently corrupting responses. Every one of those bugs would have appeared independently in any app that connected to Tastyworks directly. They appeared once, in SanthoshIAS, and every consumer inherited the fixed version automatically.

**DuckDB analytical layer.** Resolved data is written to DuckDB for historical queries. Repeat requests for the same data — same options chain, same price series — are served from cache, not re-fetched from providers. Reduces API call volume, keeps data consistent across the stack, and means historical queries never touch external APIs at all.

**MCP output interface.** SanthoshIAS exposes an MCP (Model Context Protocol) interface so AI assistants can query market data as a tool call. The design boundary was deliberate: MCP is right for tool-use output, wrong for high-throughput ingest where protocol overhead is unacceptable. The interface honours that boundary.

## Sentinel — the dashboard that keeps the stack alive

As the stack grew — SanthoshIAS, Moneta, FlowDeck, APEX, the ThetaData terminal — keeping all of it running became its own job. Services died on sleep/wake and didn't come back. One service starving another at market open turned into a cascade. Debugging a data issue meant reading five sets of logs to reconstruct what happened.

Sentinel is the answer to that: a single admin and health dashboard that supervises every service in the stack, restarts them intelligently when they fail, and turns every recurring failure into a codified playbook it can run without me. If SanthoshIAS is the service layer, Sentinel is the operations layer — one place to see what's happening, one place to fix it.

[Read the Sentinel case study →](/work/sentinel/)

## What it saves

**Development time — directly.** Every new app in the stack gets all six providers at the point of integration. No authentication code to write, no retry logic to implement, no session management to debug. Point the app at the service, call the endpoint, get data.

**Debug time — significantly.** Before SanthoshIAS and Sentinel, debugging a data issue meant checking each app's logs, tracing each provider's responses, and reconstructing what happened from scattered output. Now it's one dashboard, one view, one trace per request. The time to root-cause a data issue dropped from an hour to minutes.

**API costs — meaningfully.** The DuckDB cache layer means repeat queries for the same data don't hit provider APIs. For providers with per-call pricing or tight rate limits, the reduction is substantial.

**Cognitive overhead — the hardest one to quantify but the most important.** Running multiple apps against multiple providers without a service layer means holding a lot of state in your head: which app is connected to which provider, which session is stale, which auth token needs refreshing. SanthoshIAS and Sentinel externalize that state into a system that can be observed and reasoned about. The cognitive load drops to near zero.

## The broader principle

SanthoshIAS is a direct application of the same principle I use professionally: when you see the same problem appearing in multiple places, extract it. Don't solve it three times. Solve it once, correctly, and make the solution available as a service.

At work, that looks like a wire automation platform that all middle-office teams share. At home, it looks like SanthoshIAS — a personal infrastructure layer that all my apps share. The abstraction level is different. The reasoning is identical.
