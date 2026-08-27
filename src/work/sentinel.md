---
layout: case-study.njk
tags: work
title: "Sentinel — a self-learning admin dashboard for a personal service stack"
context: "Personal infrastructure · Node · launchd · playbooks · Port 7799 · 2026–present"
order: 7
description: "Built when the stack got big enough that keeping it running became a job of its own. Sentinel supervises every service, restarts them intelligently when they fail, and turns each recurring failure into a playbook it runs automatically the next time."
stats:
  - { n: "Port 7799", label: "one view of the whole stack" }
  - { n: "6", label: "services supervised" }
  - { n: "launchd", label: "native, survives reboot" }
  - { n: "Playbooks", label: "recurring failures auto-fixed" }
---

## The problem

[SanthoshIAS](/work/santhoshias/) solved the data-provider problem: one service layer, one contract, all apps. But solving it created a new one. The stack now had real depth — SanthoshIAS at port 7700, the Moneta API and web frontend, FlowDeck, APEX's FastAPI backend and React frontend, and a ThetaData terminal underneath all of it. Six-plus long-running services on one machine, each depending on the others.

Three failure patterns kept recurring:

**Sleep/wake death.** The Mac would sleep, a WebSocket connection to a data provider would silently drop, and the service would stay up while serving stale data. The naive health check still showed green. The first sign of trouble was an app error.

**Market-open cascades.** At 9:30 the whole stack woke up at once. A dead overnight connection, a slow provider, one service hammering another during startup — any of these could starve the machine and take down services that were otherwise fine.

**Debugging archaeology.** When data looked wrong, finding out why meant opening five terminal tabs and reconstructing a timeline from scattered logs.

None of these were hard problems individually. Together, they meant the stack needed a babysitter — and that was me, several times a week.

## What Sentinel is

Sentinel is a single admin and health dashboard on port 7799. It runs as a launchd job, starts on boot, and does three things.

**It shows the stack.** Every service in one view — SanthoshIAS, both Moneta services, FlowDeck, APEX backend and frontend, the ThetaData terminal. Green, yellow, red. Not "is the process alive" but "is this service actually doing its job" — for SanthoshIAS that means the options tape is fresh, not just that port 7700 is listening.

**It manages lifecycle.** Start, stop, and restart any service from one interface, in the right dependency order. No SSH, no terminal juggling, no remembering that APEX's backend has to be up before its frontend is useful.

**It fixes things.** When a known failure pattern shows up, Sentinel runs a playbook — a codified condition-to-action rule — instead of waiting for me to notice.

## How supervision actually works

The supervision model is deliberately boring, because boring is what survives a reboot at 3am.

Where a service can run as a native **launchd** unit, it does. SanthoshIAS and both Moneta services (`com.belgavi.monetaapi`, `com.belgavi.monetaweb`) are real launchd jobs — the OS keeps them alive, and Sentinel reads and controls their state.

Where a service can't be handed to launchd, Sentinel runs it under its own supervisor with the same guarantees. APEX's backend is the example: it loads a 225-variable environment file full of broker credentials that has no business living in a launchd plist. Sentinel owns that process directly.

Restarts are **flap-tolerant**. A service that crash-loops doesn't get hammered with restart attempts — Sentinel backs off, stops trying, and flags it red so the failure is visible instead of hidden behind a restart storm.

## Playbooks — the self-learning part

Sentinel is a self-learning admin page in a specific, practical sense: **every failure mode that recurs gets written down as a playbook, so the system handles it the next time without me.**

The first live playbook came straight out of a market-open cascade. A dead overnight WebSocket had left the SanthoshIAS options tape frozen while every health check still read green. The fix became `fd_tape_freshness`: when the tape goes stale for 18 consecutive polls, Sentinel automatically runs the SanthoshIAS restart routine and brings the feed back — usually before the first app error would have surfaced.

The learning isn't a model. It's the accumulated operational history — which services fail, when, and after what (a sleep/wake, a market open, a provider outage) — that makes the next playbook obvious to write. Sentinel is the place that history lives, so the pattern is visible instead of something I have to hold in my head.

## What it saves

**Babysitting time — directly.** The several-times-a-week manual intervention is gone. Services that die come back on their own. The stack survives sleep/wake and market open without me watching it.

**Debug time — significantly.** Root-causing a data issue used to take an hour of log archaeology across five services. With one dashboard, one timeline, and one trace per failure, it's minutes.

**Cognitive overhead — the important one.** Running a six-service stack without a supervision layer means holding a lot of fragile state in your head: which service is stale, which connection dropped overnight, which one needs to start before which. Sentinel externalizes that into a system that can be observed and reasoned about. The load drops to near zero.

## Roadmap

**More playbooks.** `theta_rest` and `theta_single_instance` are designed but not yet wired — they'll detect a dead ThetaData REST endpoint and duplicate terminal instances (a known source of connection storms) and self-heal both.

**Per-provider health on the board.** Today Sentinel sees the SanthoshIAS service as one unit. The next step is surfacing the health of each of the six providers behind it — which are connected, which are rate-limited, which are in fallback — so a provider problem is visible before it becomes a SanthoshIAS problem.

**Suggested playbooks.** Turning the accumulated failure history into automatically proposed playbooks, rather than ones I hand-author after the third time something breaks. That's the point where "self-learning" stops needing quotation marks.
