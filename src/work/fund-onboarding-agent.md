---
layout: case-study.njk
tags: work
title: "Teaching an AI agent to read fund inception documents"
context: "Private markets fund operations · LemonEdge · 2025–present"
order: 2
description: "Building a Claude-powered agent that reads fund legal documents and automates LemonEdge fund-accounting setup — eliminating weeks of manual configuration per fund launch."
stats:
  - { n: "Weeks → days", label: "fund setup time (target)" }
  - { n: "LemonEdge", label: "fund accounting platform" }
  - { n: "Claude", label: "agentic AI stack" }
  - { n: "In build", label: "status — active development" }
---
## The problem

Every fund launch begins with a pile of legal documents — the LPA, side letters, subscription documents — and ends, weeks later, with a fund-accounting platform configured to match: waterfall style, commitment structures, fee terms, SPV topology, allocation rules. Between the two sits an expensive, error-prone ritual: senior fund-accounting people reading dense legal language and hand-keying its meaning into software. It's slow, it doesn't scale with launch velocity, and a misread term surfaces months later as an allocation break.

## The obvious (wrong) answer

Throw analysts at it, or build brittle document templates that break on the first nonstandard side letter. Both approaches treat the symptom. The actual job is *interpretation* — mapping legal language onto platform configuration — and that's precisely what large language models have become good at, if you build the scaffolding that makes them reliable enough for fund accounting.

## What I'm building

A Claude-powered agent that reads fund inception documents and drives LemonEdge onboarding: extracting economic terms (European vs American waterfall mechanics, preferred return, catch-up, commitment and drawdown structures, SPV relationships), mapping them to LemonEdge's configuration model, and producing a setup that a human reviews rather than creates. The design principle is the same one I apply everywhere: the agent runs on infrastructure the operation already owns, produces auditable intermediate artifacts instead of magic answers, and keeps the fund controller in the loop as approver. This is in active development — I'm publishing the approach as it matures, because as far as I can tell nobody has documented this pattern for private markets fund operations.

## Why this matters

Fund launches are a growth bottleneck for every manager scaling its platform, and setup quality is a compounding asset: get inception configuration right and every downstream close, allocation, and report inherits the accuracy. The interesting frontier in private markets isn't AI that drafts emails — it's AI that reads the documents the business already runs on and does the structured work that used to consume expert weeks.
