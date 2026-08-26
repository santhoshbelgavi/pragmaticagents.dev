---
layout: case-study.njk
tags: work
title: "$350B in wires, 0% to 99%+ STP — no new vendor tool"
context: "A top PE firm · Treasury & Middle Office · 2022–2026"
order: 1
description: "How a purpose-built wire automation platform on Kyriba, SWIFT, and Goldman Sachs Transaction Banking rails took a top PE firm from manual wire operations to 99%+ straight-through processing."
stats:
  - { n: "$350B+", label: "wires since inception" }
  - { n: "0%→99%+", label: "straight-through processing" }
  - { n: "99.9%", label: "instructed via SWIFT" }
  - { n: "0", label: "missed deadlines in 3 years" }
---
## The problem

At institutional scale, wires are where operational risk concentrates. When I joined the treasury and middle-office modernization effort at a top PE firm, wire operations looked the way they still do at most alternative asset managers: instructions assembled manually, executed through bank portals and fax, tracked in spreadsheets, and dependent on a handful of people who knew where the bodies were buried. Straight-through processing stood at 0%. Volume was growing fast — the kind of growth that turns a manual process from an annoyance into a genuine risk position.

## The obvious (wrong) answer

A third-party vendor came to the table with a proposal. Their plan: they would build the front end — the UI that treasury staff would interact with. We would do the heavy lift: all back-end reference data maintenance, the APIs to store and retrieve data for their interface, and the integration work connecting it to Kyriba and the banking rails. We would own the complexity. They would own the surface.

Reading that proposal made the answer clear. We were being asked to build the hard part of the system regardless — so why were we also paying for their front end? The firm already owned the right rails: Kyriba as the treasury management system, SWIFT connectivity, and a Goldman Sachs Transaction Banking relationship. What was missing wasn't a platform; it was the connective tissue — payment workflows, integration specifications, reference data discipline, and exception handling designed around how the middle office actually works.

## What we built

A modular, configuration-driven wire-processing platform on the infrastructure the firm already owned. The design principle from day one was horizontal scale without rework: new funds, teams, and standing settlement instructions are added as configuration, not code — no deployment, no developer involvement. Payment sources — REST APIs, flat files, same-day real-time payments — are normalized into a single shape before entering the processing core, and adding a new source type requires only configuration. Individual funds can be enabled or disabled at any granularity: per fund, per team, or any combination the business needs.

<div class="arch-diagram">
<canvas id="archCanvas" height="380"></canvas>
<div class="arch-controls">
  <button class="arch-btn active" id="btnApi">Fire REST API wire</button>
  <button class="arch-btn" id="btnFile">Fire flat file</button>
  <button class="arch-btn" id="btnZday">Fire 0-day payment</button>
  <button class="arch-btn" id="btnAll">Fire all</button>
  <button class="arch-btn active" id="autoBtn">Auto: ON</button>
</div>
<div class="arch-stats">
  <div class="arch-stat"><div class="arch-stat-num" id="wireCount">0</div><div class="arch-stat-lbl">wires processed</div></div>
  <div class="arch-stat"><div class="arch-stat-num">$350B+</div><div class="arch-stat-lbl">since inception</div></div>
  <div class="arch-stat"><div class="arch-stat-num">99%+</div><div class="arch-stat-lbl">STP rate</div></div>
  <div class="arch-stat"><div class="arch-stat-num">99.9%</div><div class="arch-stat-lbl">via SWIFT</div></div>
</div>
<div class="arch-caption">Live simulation — sources normalize and route through the platform core to execution rails.</div>
</div>

Payment initiation was standardized across middle-office teams; instructions flow through Kyriba and out via SWIFT, with the Goldman Sachs Transaction Banking integration carrying execution. I owned the business architecture and integration design: API contract analysis and field mapping between platforms, payment workflow definition, SOW and vendor negotiation, and the process re-engineering that turned common failure modes into handled cases rather than morning surprises. The rollout deliberately attacked the error taxonomy — production issues, recurring user errors, data quality — because STP is won in the last few percent, not the first ninety.

## What changed

Straight-through processing went from 0% to 99%+, with 99.9% of transactions instructed via SWIFT. The platform has processed $350B+ in wires since inception and absorbed roughly 18x volume growth without headcount growth and without architectural rework — a direct consequence of the configuration-driven design. New funds and teams onboarded by adding data, not by touching the system. Entity onboarding — KYC, account opening, funding — compressed to about three days, and the operation has gone three years without a missed deadline. The work was recognized in the Adam Smith Awards 2024 (Highly Commended, Top Treasury Team); the public write-up is here: [Lean team delivers complete transformation](https://treasurytoday.com/asa-2024-winners/lean-team-delivers-complete-transformation/).

## Why this generalizes

The lesson isn't "never buy vendor tools." The firm buys plenty of them, and I've recommended vendors where the situation warranted it. The lesson is that the build-vs-buy question is downstream of an architecture question: what do you already own, and what's actually missing? When the missing piece is connective tissue rather than a platform, an in-house extension is cheaper, faster, and leaves you owning the asset. Answering that question honestly requires someone who can read the vendor landscape, the API contracts, and the operational reality at the same time — which is precisely the seat I like to occupy.
