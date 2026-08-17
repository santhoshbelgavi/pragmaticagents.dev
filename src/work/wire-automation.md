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

The default move was on the table from day one: buy the multi-million-dollar vendor payments platform, run an eighteen-month implementation, and reshape the firm's processes around the tool. It's the answer most consultants would have recommended, because it's the answer that can't get anyone fired. But the diagnosis didn't support it. The firm already owned the right rails — Kyriba as the treasury management system, SWIFT connectivity, and a Goldman Sachs Transaction Banking relationship. What was missing wasn't a platform; it was the connective tissue: payment workflows, integration specifications, reference data discipline, and exception handling designed around how the middle office actually works.

## What we built

A modular wire-processing platform on the infrastructure the firm already owned. Payment initiation was standardized across middle-office teams; instructions flow through Kyriba and out via SWIFT, with the Goldman Sachs Transaction Banking integration carrying execution. I owned the business architecture and integration design: API contract analysis and field mapping between platforms, payment workflow definition, SOW and vendor negotiation, and the process re-engineering that turned common failure modes into handled cases rather than morning surprises. The rollout deliberately attacked the error taxonomy — production issues, recurring user errors, data quality — because STP is won in the last few percent, not the first ninety.

## What changed

Straight-through processing went from 0% to 99%+, with 99.9% of transactions instructed via SWIFT. The platform has processed $350B+ in wires since inception and absorbed roughly 18x volume growth without headcount growth. Entity onboarding — KYC, account opening, funding — compressed to about three days, and the operation has gone three years without a missed deadline. The work was recognized in the Adam Smith Awards 2024 (Highly Commended, Top Treasury Team); the public write-up is here: [Lean team delivers complete transformation](https://treasurytoday.com/asa-2024-winners/lean-team-delivers-complete-transformation/).

## Why this generalizes

The lesson isn't "never buy vendor tools." The firm buys plenty of them, and I've recommended vendors where the situation warranted it. The lesson is that the build-vs-buy question is downstream of an architecture question: what do you already own, and what's actually missing? When the missing piece is connective tissue rather than a platform, an in-house extension is cheaper, faster, and leaves you owning the asset. Answering that question honestly requires someone who can read the vendor landscape, the API contracts, and the operational reality at the same time — which is precisely the seat I like to occupy.
