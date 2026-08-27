# Case-study template

Every page under `src/work/*.md` uses `layout: case-study.njk`, which **automatically** renders:

- **"X min read"** — computed from the article's word count (`readingTime` filter in `eleventy.config.js`). Never hand-write it.
- **TL;DR box** — from the `tldr:` frontmatter field below. Never add a `## TL;DR` heading in the body.
- Title, dotted context line, and a 4-item stat strip.

House rules: **no port numbers, no internal hostnames** anywhere — in prose, stats, context lines, or animation node labels. Say "the data service", not ":7700".

To add a case study, copy the block below to `src/work/<slug>.md` and fill it in.

```markdown
---
layout: case-study.njk
tags: work
title: "<Name> — <one-line what-it-is>"
context: "<Domain> · <Tech> · <Tech> · <YYYY>–present"
order: <n>          # sort in /work/, lower = earlier; keep unique across files
description: "<1–2 sentences for meta/OG/the work card — what it is, why, one hard number>"
tldr: "<1–3 sentences, first person: problem → what I did → the outcome that matters. Reads in ~10s.>"
stats:              # exactly 4; short value + short label; real numbers; no ports
  - { n: "<num>", label: "<what it counts>" }
  - { n: "<num>", label: "<what it counts>" }
  - { n: "<num>", label: "<what it counts>" }
  - { n: "<num>", label: "<what it counts>" }
---

## What is <Name>?

<Plain-terms opening. No ports/hostnames.>

## Why build it?

<The problem that justified building rather than buying or tolerating.>

## Architecture

<!-- Optional canvas diagram — create src/js/<slug>-animation.js first. -->
<div class="arch-diagram">
<canvas id="<slug>Canvas" height="380"></canvas>
<div class="arch-caption">One sentence on what the diagram shows. Hover any node for detail.</div>
</div>
<script src="/js/<slug>-animation.js"></script>

<Prose walkthrough, bold lead-ins per component.>

## What it saves

<Directly / significantly / the hard-to-quantify one. Tie back to the broader principle.>
```
