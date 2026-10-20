# Architecture Decisions

## ADR-001: Keep the dashboard static and framework-free

**Status:** Accepted

The console is plain HTML, CSS, and JavaScript with no build dependency. This minimizes setup risk for courtside operation and allows Netlify to deploy the repository directly.

## ADR-002: Keep authoritative active-match state in the scorer browser

**Status:** Accepted

`localStorage` supports recovery during a local scoring session. Supabase sharing mirrors the current state but does not become a multi-writer score engine.

## ADR-003: Use tokenized Edge Function access for referee sharing

**Status:** Accepted

The referee QR link needs simple mobile access without staff login. Separate random staff/referee bearer tokens are hashed in the database. RLS denies direct table access and the Edge Function validates the appropriate token.

## ADR-004: Poll the referee snapshot

**Status:** Accepted

The referee page polls every 1.2 seconds. Polling is reliable for a read-only operational display, requires no direct database policy, and automatically recovers after connection interruptions.

## ADR-005: Treat the overlap tool as assistance, not automation

**Status:** Accepted

Volleyball overlap is judged from player foot positions at service contact. The tool visualizes constraints but must not claim to make an official ruling.

## ADR-006: Tournament-specific substitution limit is eight per set

**Status:** Accepted

This competition requires a maximum of eight standard substitutions per team per set, with paired-player return restrictions. Libero exchanges remain outside this count.

