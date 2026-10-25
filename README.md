# `@manageddotnet/signalr-client`

TypeScript client for [ManagedDotNet.SignalR.Topics](https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics): fluent topic bindings over the shared wire contract `Handle(topic, payload)`.

## Wire contract

| Direction | Method | Client API |
|-----------|--------|------------|
| Client → server | `Handle(string topic, string message)` | `connection.invoke("Handle", topic, wire)` |
| Server → client | `Handle(string topic, string payload)` | `connection.on("Handle", …)` |

## Mirror of server configuration

Hub-centric names match the C# package. Transforms are **inverted** on the client. The **topic string** is the runtime registry key (TypeScript generics type payloads only and are erased at runtime).

| Fluent | Server (`ManagedDotNet.SignalR.Topics`) | Client (`@manageddotnet/signalr-client`) |
|--------|-------------------------------------------|------------------------------------------|
| `HandleOnServer` | inbound: `WithTopic` + `WithDeserializer` + `WithHandler<T>()` | outbound: topic arg + `withSerializer` (no handler) |
| `HandleOnClient` | outbound: `WithTopic` + `WithSerializer` | inbound: topic arg + `withDeserializer` + `withHandler(fn)` |

Authorization, CORS, `MapTopicHubs`, and DI are **not** mirrored — server-only.

## Install

Peer dependency: `@microsoft/signalr`.

### From npm (after first publish)

```bash
pnpm add @manageddotnet/signalr-client @microsoft/signalr
```

Requires the [`manageddotnet`](https://www.npmjs.com/org/create) npm org and an `NPM_TOKEN` secret on this repo (see Publishing below).

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

```ts
import { createTopicHubClient } from "@manageddotnet/signalr-client";

type CreateChatMessageDto = {
  roomId: string;
  tracker: string;
  text?: string;
};

type ChatMessageAckDto = {
  tracker: string;
  messageId: string;
};

const hub = createTopicHubClient({
  getUrl: () => "https://api.example.com/ChatHub",
  getAccessToken: () => accessToken,
})
  .handleOnServer<CreateChatMessageDto>("chats/messages", () => undefined)
  .handleOnClient<ChatMessageAckDto>("chats/messages/ack", (cfg) =>
    cfg.withHandler((ack) => {
      console.log("ack", ack.tracker, ack.messageId);
    }))
  .build();

await hub.connect();
await hub.send("chats/messages", {
  roomId: "…",
  tracker: crypto.randomUUID(),
  text: "hello",
});
```

Illustrative topics match a typical ChatModule registration; this package has **no** ProjectX dependency.

## API surface

- `createTopicHubClient(options)` → fluent builder
- `handleOnServer<T>(topic, cfg => cfg.withSerializer?(…))`
- `handleOnClient<T>(topic, cfg => cfg.withDeserializer?(…).withHandler(…))`
- `build()` — validates handlers; rejects duplicate topics
- `ITopicHubClient`: `connect`, `disconnect`, `state`, `send(topic, payload)`

Defaults: `JSON.stringify` / `JSON.parse`, automatic reconnect on. `send` uses the registered serializer for that topic when present; otherwise `JSON.stringify`.
