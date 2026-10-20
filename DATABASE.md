# Database

## Project

Supabase project: `IVI Volleyball Live` (`adsthcnzieqewrdfenzr`), region `eu-west-2`.

## Table: `public.live_matches`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key, generated with `gen_random_uuid()` |
| `created_at` | `timestamptz` | Creation time |
| `updated_at` | `timestamptz` | Last snapshot update |
| `ended_at` | `timestamptz` | Set when the match is finished |
| `status` | `text` | `live` or `finished` |
| `referee_token_hash` | `text` | Unique SHA-256 hash for read access |
| `staff_token_hash` | `text` | Unique SHA-256 hash for scorer updates |
| `match_state` | `jsonb` | Current browser match snapshot |
| `revision` | `bigint` | Reserved snapshot revision, defaults to `0` |

## Constraints and Indexes

- `id` is the primary key.
- `status` is constrained to `live` and `finished`.
- Token hashes are unique.
- `revision >= 0`.
- `live_matches_status_updated_at_idx` supports future live/finished-session queries and cleanup.

## Access and Migrations

- RLS is enabled. No direct browser policy exists by design; all access goes through the Edge Function with token validation.
- Use Supabase migrations for schema changes. Do not alter production schema manually in the dashboard.
- After migrations, run Supabase security and performance advisors.

## Retention

There is no automated retention job yet. Match snapshots are operational data and should be deleted or archived according to the competition's retention policy before the table grows indefinitely.

