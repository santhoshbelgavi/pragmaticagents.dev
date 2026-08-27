---
layout: case-study.njk
tags: work
title: "KidStream — curated, self-hosted media for kids. **No algorithm, no ads**"
context: "Personal infrastructure · Pinchflat · Jellyfin · Swiftfin · Apple TV · NAS"
order: 8
description: "A self-hosted children's media stack that runs on home infrastructure. Allowlisted content only, no recommendation algorithm, no ads, no tracking. The local-first philosophy applied to the toughest user base there is."
tldr: "A self-hosted media stack for my kids: allowlisted content only, no recommendation algorithm, no ads, no tracking. Pinchflat pulls the videos, Jellyfin serves them, an Apple TV plays them — all on home infrastructure."
stats:
  - { n: "0", label: "ads served" }
  - { n: "0", label: "algorithmic recommendations" }
  - { n: "100%", label: "curated content only" }
  - { n: "NAS", label: "runs on home infrastructure" }
---

## What is KidStream?

KidStream is a self-hosted media stack for children — a curated library of age-appropriate content that runs entirely on home infrastructure and presents through a clean Apple TV interface. There is no recommendation algorithm. There are no ads. There is no "up next" that drifts toward content you didn't approve. Every title in the library was put there deliberately.

It is the local-first philosophy applied to the toughest user base there is.

## Why?

YouTube Kids has an algorithm. The algorithm optimises for engagement. Engagement for children means progressively more stimulating content — longer watch times, more frequent context switches, more emotional activation. These are not the properties you want optimising your children's media diet.

Netflix and Disney+ have recommendation engines that surface content you haven't approved. They also have ads on lower tiers and tracking across sessions. The parental controls are coarse and the content catalogue is not static — titles you approved last month may be different this month.

The alternative — curate the library yourself, host it yourself, serve it yourself — sounds like more work than it is. Once it runs, it runs.

## What I built

**Pinchflat** handles content acquisition — a self-hosted YouTube downloader with allowlist-based channel subscriptions. Only approved channels are downloaded. New content from approved channels arrives automatically. Nothing outside the allowlist enters the library.

**Jellyfin** is the media server — open-source, self-hosted, no tracking, no subscription. It organises the library, serves transcoded streams, and manages the user profiles. Each child has a profile with age-appropriate content visibility.

**Swiftfin** is the native iOS/tvOS Jellyfin client — a cleaner interface than the web player, with full Apple TV remote support. The children interact with Swiftfin on an Apple TV. From their perspective it looks and feels like a normal streaming app, minus the algorithm and the ads.

**The NAS.** Everything runs on a Terramaster F2-425 Plus behind Tailscale. The same NAS that runs Moneta, SanthoshIAS, FlowDeck, and APEX runs KidStream. One infrastructure bill. One maintenance surface. Consistent backup strategy across everything.

## Architecture

The stack is deliberately simple. Pinchflat runs on a schedule, checks approved channels, downloads new content to a mounted volume, and exits. Jellyfin watches the volume and picks up new files automatically. Swiftfin connects to Jellyfin over the local network (or Tailscale when away from home). No moving parts at runtime.

```
Pinchflat (scheduled)
    ↓ downloads to NAS volume
Jellyfin (media server, always-on)
    ↓ serves transcode streams
Swiftfin on Apple TV (client)
    ↓ controlled by child with Apple TV remote
```

Parental management happens in Jellyfin: add an approved channel to the Pinchflat allowlist, content arrives in the library within the next scheduled run. Remove a channel, existing content stays (for now), no new content arrives. Age-appropriate visibility is controlled at the Jellyfin user-profile level.

## What it saves

**Monthly:** no YouTube Premium, no Disney+ (for KidStream purposes), no ad-supported tier with tracking. The content acquisition cost is zero after hardware.

**More importantly:** the algorithm is gone. Watch time on KidStream is calm and finite — children watch something they chose, it ends, they move on. There's no "autoplay next" pulling them deeper into a queue. The content my children consume was chosen by me, not optimised by a machine whose objectives are not aligned with their wellbeing.

## The signal this sends

KidStream is the simplest project in the stack. It's also the one that most directly reflects the underlying philosophy: if you have the capability to own and control something important, and the alternative is delegating control to a system with misaligned incentives, the right answer is usually to own it.

That principle applies to financial data (Moneta), market data routing (SanthoshIAS), trading infrastructure (APEX), and children's media (KidStream). The domain changes. The reasoning doesn't.
