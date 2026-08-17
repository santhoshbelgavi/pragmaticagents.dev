---
layout: case-study.njk
tags: work
title: "Why I replaced a paid options-flow SaaS with ~800 lines of Rust"
context: "Personal infrastructure · FlowDeck · self-hosted"
order: 3
description: "The build-when-warranted philosophy applied at home: replacing a paid options-flow analytics subscription with a purpose-built Rust system."
stats:
  - { n: "~800", label: "lines of Rust at the core" }
  - { n: "1", label: "SaaS subscription cancelled" }
  - { n: "Rust", label: "flowengine crate" }
  - { n: "Self-hosted", label: "runs on my own NAS" }
---
## The problem

I trade options, and I was paying for a flow-analytics SaaS to surface unusual activity. The tool was fine. It was also opaque about its scoring, rigid about its filters, and dependent on someone else's uptime — three properties I spend my professional life engineering out of operational systems.

## The obvious answer, examined honestly

Keep paying. Subscription software is usually the right call — that's the whole point of the vendor/extend/build framework I apply at work. The build case has to be earned. Here it was: the data feeds were already flowing through my own gateway, the analysis I wanted was specific and stable, and the vendor's value-add was mostly a UI over logic I understood better than the marketing page did.

## What I built

FlowDeck: a self-hosted options-flow platform with a Rust core — a `flowengine` crate of roughly 800 lines that ingests live trades, classifies them, and scores composite signals with z-score normalization, plus a JSON filter DSL so new screens are configuration, not code. It runs on my home NAS alongside the rest of my stack and serves the same dashboards the SaaS did — except I can read every line of the scoring logic.

## Why this generalizes

This is the same judgment I bring to a treasury platform or a fund-accounting build, applied at personal scale: the question is never "build or buy" as ideology — it's what you already own, what's actually differentiating, and whether the vendor is selling you a platform or a UI. Sometimes the honest answer is 800 lines of Rust.
