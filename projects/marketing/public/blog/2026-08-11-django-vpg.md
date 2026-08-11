---
title: "Making Django Fast: Postgres"
description: "Introducing django-vpg, a Rust tokio-postgres Django database engine with one connection pool shared across sync Python, asyncio, and Rust."
author: "David Burke"
published: true
---

Introducing [django-vpg](https://gitlab.com/glitchtip/django-vpg) a Rust tokio-postgres PyO3 based Django Database Engine. It solves a few remaining issues for GlitchTip's Django optimization.

In GlitchTip, we optimized the event ingest path in Rust. This API is responsible for most traffic and even a slight optimization pays off in saved ram and cpu cycles. We needed a database engine that could:

- Call Postgres from Rust or Python with a single connection pool
- Unifies async and sync Python connections, important when calling asyncio based database queries
- Low memory footprint, if we can!

I want to be upfront and note that django-vpg is not for everyone. psycopg is fast already in many cases. We see major performance improvements our prior project, django-vcache. vpg completes the family of Rust based IO, but is more useful when you truly need asyncio or calls from Rust. If that isn't you, I wouldn't drop in django-vpg.

The throughput benchmarks below ran on an AMD desktop (6c/12t, 30 GiB), PostgreSQL 18.4 in rootless podman, CPython 3.13.5, Django 6.0.7, django-vpg 0.3.1 installed from PyPI, single uvicorn worker, with 2.23 ms median database round-trip injected using `netem`. A loopback database makes every driver look the same, so the latency matters. Three configurations hit the same database and table; only the driver and the async mechanism differ — `psycopg` is Django's built-in thread-pooled async ORM, `vpg` is the same thread-pooled ORM with the `ENGINE` swapped, and `vpg async` is the true-async ORM via django-async-backend. The memory benchmark at the end is a driver-level harness on a different machine (PostgreSQL 18.2, CPython 3.14, psycopg 3.3.4) and needs no injected latency, because retained memory is not a latency effect. Every harness and its raw JSON is in the repo's `benchmarks/` directory, so you can check any of this yourself.

### Realistic mixed ASGI workload (concurrency 64)

Three async endpoints: a read (point-get, `acount`, raw scalar), a write (raw `INSERT ... RETURNING`, ORM `aupdate` of a jsonb column, raw `DELETE`), and a mixed one that adds real CPU-bound work so the database isn't 100% of request time.

| endpoint | metric | psycopg | vpg | vpg async |
|---|---|---:|---:|---:|
| **read** | Requests/sec | 466 | 531 (+14%) | 838 (+80%) |
| | CPU ms/req | 2.38 | 2.13 (−11%) | 1.36 (−43%) |
| **write** | Requests/sec | 585 | 674 (+15%) | 935 (+60%) |
| | CPU ms/req | 1.94 | 1.73 (−11%) | 1.24 (−36%) |
| **mixed** | Requests/sec | 379 | 448 (+18%) | 718 (+90%) |
| | CPU ms/req | 3.00 | 2.53 (−16%) | 1.63 (−46%) |

Across the full matrix of 3 endpoints by concurrency 16/64/128, the drop-in gains +13–18% requests/sec at 10–16% less CPU per request, and no cell regresses. The true-async path gains +52–93% at 33–47% less CPU. On this workload both vpg configurations sit 5–7% *above* psycopg on peak RSS: the tokio runtime's fixed baseline dominates when payloads are small.

### Where psycopg still wins

Single connection, no concurrency, 20k iterations, no injected latency:

| | `SELECT 1` | jsonb round-trip |
|---|---:|---:|
| **psycopg sync** | **25.8k ops/s** | 23.4k |
| psycopg async | 20.5k | 19.6k |
| vpg sync | 24.1k | **23.3k** |
| vpg async (driver) | 15.5k | 15.6k |

One isolated call is cheaper through mature libpq than through PyO3 and tokio, and the awaitable adds more overhead still. vpg's cost only pays off under concurrency, on wide reads, and under memory pressure.

### Memory: the large payload problem

Here is the one that matters, and it took us two tries to understand it properly.

A per-connection protocol buffer grows to the largest message that connection ever carried, and keeps that capacity. So the cost isn't per-operation — it's the sum, over every pooled connection, of the biggest thing each one ever touched. libpq grows its buffers and never shrinks them. tokio-postgres does the same thing, by reusing its buffers with a `clear()` that keeps capacity. One 8 MB event pins 8 MB on that connection for as long as it lives, no matter how small the rest of its traffic is.

That makes this invisible in a small test and an OOM kill in production. It needs a realistic pool and *varied* payload sizes — which is the exact shape of event ingest.

A pool of 20, 600 INSERT+SELECT round trips with payloads drawn from 4 KiB to 8 MiB, then 6,000 tiny statements so every connection gets a chance to release:

| | baseline | Peak RSS | after the load | growth |
|---|---:|---:|---:|---:|
| psycopg | 39 MB | 609 MB | 495 MB | +457 MB |
| psycopg, prepared statements on | 39 MB | 597 MB | 506 MB | +467 MB |
| psycopg, connection recycling on | 39 MB | 532 MB | 52 MB | +13 MB |
| **django-vpg** | 21 MB | **226 MB** | **37 MB** | **+16 MB** |
| django-vpg, buffer cap disabled | 21 MB | 808 MB | 691 MB | +669 MB |

Two numbers do the work. vpg's peak is **2.7x lower**, and peak is what gets a pod OOM-killed. And when the load stops, vpg gives the memory back — 37 MB against psycopg's 495 MB, a **13x difference in what the process still holds**.

The other three rows are there because they're the rows that stop you fooling yourself:

**It is not the statement cache.** This was our own wrong guess for a while. Enabling prepared statements in psycopg changes the growth by 2% (+457 vs +467 MB) — it cannot be the cache holding that memory. Django settles it anyway: the stock Postgres backend sets `prepare_threshold=None`, so psycopg under Django prepares nothing at all. We did have an unbounded statement cache, but it was *ours* — deadpool's per-connection cache, which grew until a worker restart, about 30 MB an hour. We fixed it by copying psycopg's own two guards. Different bug, different fix, and psycopg was never guilty of it.

**Recycling reclaims, but it does not prevent.** Retire connections often enough and the retained memory goes away — +13 MB, as good as vpg. The peak doesn't move: still 532 MB, because recycling cleans up *after* the spike. You pay 40 connection opens for a pool of 20 to get that, and it silently does nothing when connections are never idle long enough to be retired, which is precisely when you're under load.

**And this is not something Rust gave us for free.** With our buffer cap turned off, vpg is *worse than psycopg* — 808 MB peak — because tokio-postgres retains on the send side where libpq at least flushes incrementally. The fix is a small patch we vendor into tokio-postgres. Rust bought us the ability to fix it; it didn't do the fixing.

There is one area I would suggest django-vpg - if you have very large INSERT's. psycopg holds on to ram in this case until the connection recycles. The default 1 hour recycle is good enough for most users, but in GlitchTip this takes real ram and hold it. [Find issue to link here]. Harmless at small scale, can lead to OOM kills at scaled and constrained environments, what we target.
