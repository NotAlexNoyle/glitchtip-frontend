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

Benchmarks below ran on an AMD desktop (6c/12t, 30 GiB), PostgreSQL 18.4 in rootless podman, CPython 3.13.5, Django 6.0.7, django-vpg 0.3.1 installed from PyPI, single uvicorn worker, with 2.23 ms median database round-trip injected using `netem`. A loopback database makes every driver look the same, so the latency matters. Three configurations hit the same database and table; only the driver and the async mechanism differ — `psycopg` is Django's built-in thread-pooled async ORM, `vpg` is the same thread-pooled ORM with the `ENGINE` swapped, and `vpg async` is the true-async ORM via django-async-backend. Raw JSON is in the repo's `benchmarks/results/`.

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

### Memory: retained buffer capacity

A pool of 20 connections, 10,000 heavy-tailed events (mostly a few KiB, thin tail to 8 MiB), each pushed out as an INSERT parameter and pulled back as a SELECT value, then a long tail of tiny statements so every connection gets a chance to release.

| | baseline | Peak RSS | growth | connections opened |
|---|---:|---:|---:|---:|
| psycopg, no recycling | 47 MB | 379 MB | +337 MB | 20 |
| psycopg, recycling on | 47 MB | 279 MB | +238 MB | 40 |
| **django-vpg** | 50 MB | **66 MB** | **+19 MB** | 20 |
| django-vpg, buffer cap disabled | 50 MB | 871 MB | +825 MB | 20 |

Peak is the number that gets a pod OOM-killed, and vpg's peak here is 5.7x lower than psycopg's. Connection recycling is only a partial mitigation: it cut psycopg's growth at the price of twice the connection opens, and it doesn't touch the peak at all, because it reclaims memory after the spike rather than preventing it. The last row is the honest part — this is not a free property of being written in Rust. tokio-postgres ratchets the same way libpq does, and worse, because it retains on the send side where libpq flushes incrementally. Our own initial Rust driver suffered from this until we bound it.

There is one area I would suggest django-vpg - if you have very large INSERT's. psycopg holds on to ram in this case until the connection recycles. The default 1 hour recycle is good enough for most users, but in GlitchTip this takes real ram and hold it. [Find issue to link here]. Harmless at small scale, can lead to OOM kills at scaled and constrained environments, what we target.
