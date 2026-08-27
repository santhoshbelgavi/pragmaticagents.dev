---
layout: case-study.njk
tags: work
title: "SanthoshIAS — a Rust gateway that makes six data providers look like one"
context: "Personal infrastructure · Rust · DataResolver · DuckDB · 2024–present"
order: 5
description: "A financial data gateway with priority-chain failover across six market data providers. One clean API for every consumer. The same integration architecture pattern used in institutional systems, pressure-tested at personal scale."
stats:
  - { n: "6", label: "data providers unified" }
  - { n: "Rust", label: "zero-cost abstractions" }
  - { n: "Port 7700", label: "one endpoint, all providers" }
  - { n: "0", label: "consumer changes when a provider fails" }
---

## What is SanthoshIAS?

SanthoshIAS is a Rust-built financial data gateway that sits between my personal stack — Moneta, FlowDeck, APEX — and six market data providers: ThetaData, QuantData, DXLink, Alpaca, IBKR, and Tastyworks. Every consumer in the stack makes one call to port 7700. SanthoshIAS decides which provider answers it, in which order, and what to do if a provider is down or rate-limited.

The name is IAS — Intelligent Aggregation Service. It's not ironic.

## Why?

Managing market data providers is a tax on every system that needs them. Each provider has a different API shape, different authentication flow, different rate limits, different reliability characteristics, and different coverage gaps. When you build a system that talks directly to providers, you couple every consumer to every provider's quirks. Add a new provider, change every consumer. A provider goes down, every consumer needs a fallback strategy.

This is the same integration problem that exists at institutional scale — a fund administrator routing settlement data across Swift, Kyriba, and multiple bank APIs, or a trading desk aggregating market data from Bloomberg, Refinitiv, and proprietary feeds. The solution at institutional scale is a normalisation and routing layer. SanthoshIAS is that layer, built for a personal stack, in Rust.

## Architecture

The core design is a **DataResolver** with priority-chain routing. Each data type (options chain, equity price, volume profile, account positions, order routing) has a ranked list of providers. SanthoshIAS tries the first, falls through to the second on failure, and so on — automatically, with no consumer involvement.

<div class="arch-diagram">
<canvas id="santhoshiasCanvas" height="380"></canvas>
<div class="arch-caption">Consumers call one endpoint. DataResolver routes to the right provider. Failover is automatic. Hover over any node to see what it does.</div>
</div>
<script src="/js/santhoshias-animation.js"></script>

**Provider connectors — six built, one painful.** The Tastyworks connector required six bug fixes before it worked correctly: a missing `client_id` in the OAuth body, wrong `expires_in` handling, an unconditional refresh loop that re-authenticated on every request, per-request client instantiation creating unnecessary overhead, a wrong auth header format, and a spurious legacy fallback that silently corrupted responses. Every one of these was a well-hidden bug that a dynamic language would have let through quietly. Rust's type system surfaced four of the six at compile time.

**DuckDB analytical layer.** SanthoshIAS writes resolved data to a DuckDB instance for historical queries. Moneta, APEX, and FlowDeck can query historical market data without re-fetching from providers — reducing API calls and keeping data consistent across the stack.

**MCP output interface.** SanthoshIAS exposes an MCP (Model Context Protocol) interface for AI assistant integration. The architecture decision was deliberate: MCP is correct for tool-use output — Claude or another model asking for market data — but wrong for high-throughput ingest, where the protocol overhead is unacceptable. The boundary is clear and the interface honours it.

## What it saves

**Provider costs.** SanthoshIAS caches resolved data in DuckDB. Repeat queries for the same data — the same options chain, the same price series, the same position snapshot — are served from cache, not billed to provider APIs. The reduction in API call volume is significant for providers that charge per-call or have tight rate limits.

**Development time.** Every new consumer in the stack (a new Moneta module, a new APEX scanner, a new FlowDeck filter) gets all six providers for free at the point of integration. The DataResolver handles failover, authentication, rate limiting, and response normalisation. New consumers write to one clean interface and inherit the full provider network.

**Reliability.** When ThetaData has an outage — which happens — QuantData picks up the load automatically. When QuantData's vol surface data lags, DXLink fills in. No manual intervention, no consumer-level fallback code, no incidents.

## The institutional parallel

The architecture of SanthoshIAS is structurally identical to the payment normalisation and routing layer in the wire automation platform at work — different domain, same pattern. One entry point, priority-chain resolution, provider-specific adapters behind a common interface, analytical layer for historical queries. Building SanthoshIAS at personal scale with real money on the line made the institutional pattern sharper. The debugging surface is smaller, the failure modes are more visible, and the accountability is direct.

That's the point of running a personal stack at this level of sophistication.
