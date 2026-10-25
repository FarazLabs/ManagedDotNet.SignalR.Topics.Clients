# `@manageddotnet/signalr-client`

TypeScript client for [ManagedDotNet.SignalR.Topics](https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics): fluent topic bindings over the shared wire contract `Handle(topic, payload)`.

## Wire contract

| Direction | Method | Client API |
|-----------|--------|------------|
| Client → server | `Handle(string topic, string message)` | `hub.handle(instance)` → `invoke("Handle", topic, wire)` |
| Server → client | `Handle(string topic, string payload)` | `connection.on("Handle", …)` → registered handler |

## Mirror of server configuration

Hub-centric names match the C# package. Transforms are **inverted** on the client.

| Fluent | Server (`ManagedDotNet.SignalR.Topics`) | Client (`@manageddotnet/signalr-client`) |
|--------|-------------------------------------------|------------------------------------------|
| `HandleOnServer` | inbound: `WithTopic` + `WithDeserializer` + `WithHandler<T>()` | outbound: message **class** + `withTopic` + `withSerializer?` |
| `HandleOnClient` | outbound: `WithTopic` + `WithSerializer` | inbound: `withTopic` + `withDeserializer?` + `withHandler(fn)` |

Internal registries use the same names as the server:

- `_handleOnServerConfigurations` — keyed by message class (client outbound lookup, like server `TopicClientProxy.Handle`)
- `_handleOnClientConfigurations` — keyed by topic string (client inbound lookup)

Authorization, CORS, `MapTopicHubs`, and DI are **not** mirrored — server-only.

## Install

Peer dependency: `@microsoft/signalr`. Node **22.18+** (or 24.11+ / 26+) if you run TypeScript with `--experimental-strip-types`.

### From npm (after first publish)

```bash
pnpm add @manageddotnet/signalr-client @microsoft/signalr
```

Requires the [`manageddotnet`](https://www.npmjs.com/org/create) npm org and an `NPM_TOKEN` secret on this repo (see Publishing below).

### From a local sibling checkout

```bash
pnpm add file:../ManagedDotNet.SignalR.Topics.Client @microsoft/signalr
# in the client package:
pnpm build
```

### From a GitHub Release tarball

```bash
pnpm add https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics.Clients/releases/download/v0.1.0/manageddotnet-signalr-client-0.1.0.tgz @microsoft/signalr
```

## Publishing

1. Create the npm organization [`manageddotnet`](https://www.npmjs.com/org/create) (scoped packages need an org/user of that name).
2. Create a granular npm access token with publish rights for `@manageddotnet/*`.
3. Add it as repo secret `NPM_TOKEN` on [FarazLabs/ManagedDotNet.SignalR.Topics.Clients](https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics.Clients/settings/secrets/actions).
4. Create a GitHub Release (or run the **Publish** workflow). CI runs `pnpm publish --access public`.

## Quick start

Outbound payloads must be **class instances** (runtime constructor identity). Avoid TypeScript parameter properties if you use Node strip-types.

```ts
import { createTopicHubClient } from "@manageddotnet/signalr-client";

class CreateChatMessageDto {
  public readonly roomId: string;
  public readonly tracker: string;
  public readonly text?: string;

  public constructor
  (
    roomId: string,
    tracker: string,
    text?: string,
  )
  {
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
  .handleOnServer(CreateChatMessageDto, (cfg) =>
    cfg
      .withTopic("chats/messages"))
  .handleOnClient<ChatMessageAckDto>((cfg) =>
    cfg
      .withTopic("chats/messages/ack")
      .withHandler((ack) => {
        console.log("ack", ack.tracker, ack.messageId);
      }))
  .build();

await hub.connect();
await hub.handle(
  new CreateChatMessageDto("…", crypto.randomUUID(), "hello"),
);
```

Demo against the Topics OrderBook server: see [ManagedDotNet.SignalR.Topics/examples/Clients/ts](https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics/tree/main/examples/Clients/ts).

## API surface

- `createTopicHubClient(options)` → fluent builder
- `handleOnServer(MessageClass, cfg => cfg.withTopic(…).withSerializer?(…))`
- `handleOnClient<T>(cfg => cfg.withTopic(…).withDeserializer?(…).withHandler(…))`
- `build()` — validates handlers; rejects duplicate topics / message classes
- `ITopicHubClient`: `connect`, `disconnect`, `state`, `handle(instance)`

Defaults: `JSON.stringify` / `JSON.parse`, automatic reconnect on. `handle` looks up `_handleOnServerConfigurations` by `instance.constructor`.
