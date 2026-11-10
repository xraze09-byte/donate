# RZ CLAN Donate

Single-file static web app (`index.html`): donation page for viewers, admin
queue for the streamer, and a live alert overlay for OBS. Hosted as static
files (Vercel works fine, see `vercel.json`).

Realtime delivery (donor phone -> admin queue -> OBS overlay) goes through a
separate WebSocket relay, which lives in the
[`donate-backend`](https://github.com/xraze09-byte/donate-backend) repo.
Vercel cannot hold WebSocket connections open, so the relay must run on an
always-on Node host such as Render, Railway or Fly.io.

## Views

Everything is one page, switched by the URL hash:

| Hash | Who | What |
| --- | --- | --- |
| *(none)* | donor | donation form, payment modal, rank lookup |
| `#admin` | streamer | pending queue, approve/reject, Insights, settings |
| `#overlay?k=<key>` | OBS browser source | alert card, TTS, goal bar |

Use the same channel key (`k`) and relay URL everywhere so all three join the
same room. Links copied from the admin Editor already carry these.

## Safety features

- **Content Shield**: profanity filter for names and messages, tolerant of
  dots, spaces and leetspeak, with whole-word matching to avoid false
  positives (Scunthorpe problem). Flagged requests are marked in the admin
  queue, and the overlay filters again as a last line of defense.
- **Anti-spam**: 20 s cooldown per device and a cap of 3 unverified pending
  requests per device.
- **Duplicate slip detection**: perceptual hash comparison of payment slips.
- **OBS hardening**: single relay socket with coalesced exponential-backoff
  reconnect, alert queue cap, no admin UI chrome on the overlay, double
  approval does not emit a second alert.
- **TTS**: queued until the first user gesture when the browser blocks
  autoplay, expired items are dropped, one fetch and one playback per alert.
- **Admin Insights**: repeat-donor list (2+ donations only), HTML-escaped.
- **Admin auth**: uses the relay's `/admin/check`; if the relay answers 503
  (admin password mode off) it falls back to the local passphrase gate.

## Tests

Tests run the real `index.html` in jsdom.

```
npm install
npm test
```

`npm test` runs every `test/*.test.js` in parallel and fails if any file
fails. A single file can be run with `node test/<name>.test.js`.

## Deploy

Push to the default branch. If the repo is connected to Vercel, it deploys
automatically (`vercel.json` only sets `Cache-Control`; there is no build
step).
