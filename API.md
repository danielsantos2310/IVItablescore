# API

## `live-match` Edge Function

Base URL:

```text
https://adsthcnzieqewrdfenzr.supabase.co/functions/v1/live-match
```

Responses use JSON and `Cache-Control: no-store`. CORS accepts the static dashboard origin because authorization is enforced by random bearer tokens.

### Create a share session

`POST /live-match`

```json
{ "action": "create", "match_state": { "id": "IVI-001" } }
```

Response `201`:

```json
{ "match_id": "uuid", "staff_token": "secret", "referee_token": "secret", "revision": 0 }
```

Store `staff_token` only on the scorer device. Construct the referee URL with `match_id` and `referee_token`.

### Update a share session

`POST /live-match`

```json
{ "action": "update", "match_id": "uuid", "staff_token": "secret", "match_state": { "id": "IVI-001" } }
```

Use `action: "finish"` when the local match is finished. Successful response: `{ "revision": 0, "status": "live" }` or `"finished"`.

### Read a referee snapshot

`GET /live-match?match_id=uuid&token=referee-token`

Response `200`:

```json
{ "state": { "id": "IVI-001" }, "status": "live", "revision": 0, "updated_at": "ISO-8601" }
```

### Errors

| Status | Meaning |
| --- | --- |
| 400 | Invalid payload, token, UUID, or action |
| 404 | Session missing or token does not match |
| 405 | Unsupported HTTP method |
| 500 | Function/database failure; no internal details are returned |

The complete implementation is at `supabase/functions/live-match/index.ts`.

