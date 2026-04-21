---
type: concept
tags: [bootstrapping, host-service, ux]
deferred: post-mvp
---

> **[2026-04-21] Full feature deferred — post-MVP per [[decisions]] D25.** MVP ships a minimal variant inside M7.8 (see [[27-mvp-builtin-mcp]]) that waits for the three preloaded MCPs before enabling the composer. Full health/retry UX deferred.

# Feature 15 — Connection gate

**Status**: spec drafted `[2026-04-19]`. Depends on [[11-host-service]] + [[packages/host-client]].

## Why

First paint needs a splash, not a "no host" error. OpenCode desktop's `ConnectionGate` (`packages/app/src/app.tsx`) is the pattern — blocking initial health check (10s), then background mode with a retry-every-1s loop, with an inline fallback showing a workspace list and any known alternate hosts.

## Modes

```
blocking:   render <Splash /> + block child mount until host responds or 10s pass
background: children mount; if host later drops, an inline retry banner shows
```

Transitions:

- On mount → `blocking`. Start health poll. If ok under 10s, flip to `background` with `connected = true`. If not, flip to `background` with `connected = false`.
- Every 1s in `background`, re-poll. On healthy response, set `connected = true`; on failure, set `connected = false`.

## UX

- `connected = false` in `background` → small dismissible banner at the top of the shell: "Can't reach local host service" + [Retry] + [Switch host…].
- `Switch host…` surfaces any previously-paired hosts (including remote ones once [[D18]] is revisited). For v1, always one host.
- Never hide the shell once past `blocking` — letting the user at least write in the chat pane (queued) is better than a full splash.

## API

```ts
export function ConnectionGate(props: {
  hostClient: HostClient;
  disableHealthCheck?: boolean; // for tests + Storybook
  children: React.ReactNode;
}): JSX.Element;
```

## Test coverage

- Host never responds → banner appears after 10s; children still mount.
- Host recovers → banner auto-dismisses.
- Host oscillates → debounce banner show/hide (min visible 2s).

## Reference

- OpenCode desktop `packages/app/src/app.tsx` § `ConnectionGate`.
