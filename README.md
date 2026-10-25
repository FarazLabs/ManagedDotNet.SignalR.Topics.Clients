# `@farazlabs/topichub-client`

TypeScript client for [ManagedDotNet.SignalR.Topics](https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics): fluent topic bindings over the shared wire contract `Handle(topic, payload)`.

Published to **npm** as [`@farazlabs/topichub-client`](https://www.npmjs.com/package/@farazlabs/topichub-client). Every push to `main` that passes CI bumps the patch version and publishes.

## Wire contract

| Direction       | Method                                 | Client API                                               |
| --------------- | -------------------------------------- | -------------------------------------------------------- |
| Client → server | `Handle(string topic, string message)` | `hub.handle(instance)` → `invoke("Handle", topic, wire)` |
| Server → client | `Handle(string topic, string payload)` | `connection.on("Handle", …)` → registered handler        |

## Mirror of server configuration

Hub-centric names match the C# package. Transforms are **inverted** on the client.

| Fluent           | Server (`ManagedDotNet.SignalR.Topics`)                        | Client (`@farazlabs/topichub-client`)                          |
| ---------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| `HandleOnServer` | inbound: `WithTopic` + `WithDeserializer` + `WithHandler<T>()` | outbound: message **class** + `withTopic` + `withSerializer?`  |
| `HandleOnClient` | outbound: `WithTopic` + `WithSerializer`                       | inbound: `withTopic` + `withDeserializer?` + `withHandler(fn)` |

Internal registries use the same names as the server:

- `_handleOnServerConfigurations` — keyed by message class (client outbound lookup, like server `TopicClientProxy.Handle`)
- `_handleOnClientConfigurations` — keyed by topic string (client inbound lookup)

Authorization, CORS, `MapTopicHubs`, and DI are **not** mirrored — server-only.

## Install

`@microsoft/signalr` is a normal dependency (installed transitively). Node **22.18+** (or 24.11+ / 26+) if you run TypeScript with `--experimental-strip-types`.

### From npm

```bash
pnpm add @farazlabs/topichub-client
```

### From a local sibling checkout

```bash
pnpm add file:../ManagedDotNet.SignalR.Topics.Client
# in the client package:
pnpm build
```

## Publishing

Automated: push to `main` → CI verify → patch bump → `pnpm publish --access public` to the npm registry. Requires repo secret `NPM_TOKEN` (granular npm token with publish rights for `@farazlabs/*`). Version commits use `[skip ci]` so they do not republish.

## Quick start

Outbound payloads must be **class instances** (runtime constructor identity). Avoid TypeScript parameter properties if you use Node strip-types.

```ts
import { createTopicHubClient } from "@farazlabs/topichub-client";

class CreateChatMessageDto {
  public readonly roomId: string;
  public readonly tracker: string;
  public readonly text?: string;

  public constructor(roomId: string, tracker: string, text?: string) {
    this.roomId = roomId;
    this.tracker = tracker;
    this.text = text;
  }
}

type ChatMessageAckDto = {
  tracker: string;
  messageId: string;
};

const hub = createTopicHubClient({
  getUrl: () => "https://api.example.com/ChatHub",
  getAccessToken: () => accessToken,
})
  .handleOnServer(CreateChatMessageDto, (cfg) => cfg.withTopic("chats/messages"))
  .handleOnClient<ChatMessageAckDto>((cfg) =>
    cfg
      .withTopic("chats/messages/ack")
      .withDeserializer((payload) => JSON.parse(payload) as ChatMessageAckDto)
      .withHandler((ack) => {
        console.log("ack", ack.tracker, ack.messageId);
      }),
  )
  .build();

await hub.connect();
await hub.handle(new CreateChatMessageDto("…", crypto.randomUUID(), "hello"));
```

Demo against the Topics OrderBook server: see [ManagedDotNet.SignalR.Topics/examples/Clients/ts](https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics/tree/main/examples/Clients/ts).

## API surface

- `createTopicHubClient(options)` → fluent builder
- `handleOnServer(MessageClass, cfg => cfg.withTopic(…).withSerializer?(…))`
- `handleOnClient<T>(cfg => cfg.withTopic(…).withDeserializer?(…).withHandler(…))`
- `build()` — validates handlers; rejects duplicate topics / message classes
- `ITopicHubClient`: `connect`, `disconnect`, `state`, `handle(instance)`

Defaults: `JSON.stringify` / `JSON.parse`, automatic reconnect on. `handle` looks up `_handleOnServerConfigurations` by `instance.constructor`.

## Development

This repo uses [pnpm](https://pnpm.io) (see `packageManager` in `package.json`; `corepack enable` picks the right version).

| Command                             | What it does                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm install`                      | Install dependencies                                                                       |
| `pnpm build`                        | Bundle `src` with [tsdown](https://tsdown.dev) into `dist/` (ESM + CJS + `.d.ts`/`.d.cts`) |
| `pnpm typecheck`                    | `tsc --noEmit` over `src` and `tests`                                                      |
| `pnpm lint` / `pnpm lint:fix`       | ESLint (typescript-eslint, type-aware)                                                     |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                   |
| `pnpm test`                         | Unit tests (Vitest) against `src`                                                          |
| `pnpm test:dist`                    | Builds, then tests the _built_ package: ESM/CJS smoke test and tree-shaking guard          |
| `pnpm test:treeshake`               | Only the tree-shaking guard                                                                |
| `pnpm check:package`                | `publint` + `attw` (are-the-types-wrong) on the packed tarball                             |
| `pnpm verify`                       | Everything above, as run by CI and `prepublishOnly`                                        |

### Tree-shaking guard

`tests/dist/treeshake.test.ts` bundles each public runtime export _on its own_ (esbuild and Rollup) against `dist/` and asserts that only the code it needs ends up in the bundle, within a byte budget. Rollup runs without trusting `sideEffects`, so an accidental top-level side effect fails the test. Adding or renaming a public export fails the "every export has an expectation" test until you add its entry (markers + budget).
