# `@manageddotnet/signalr-client`

TypeScript client for [ManagedDotNet.SignalR.Topics](https://github.com/FarazLabs/ManagedDotNet.SignalR.Topics): fluent topic bindings over the shared wire contract `Handle(topic, payload)`.

## Wire contract

| Direction | Method | Client API |
|-----------|--------|------------|
| Client → server | `Handle(string topic, string message)` | `connection.invoke("Handle", topic, wire)` |
| Server → client | `Handle(string topic, string payload)` | `connection.on("Handle", …)` |

## Mirror of server configuration

Hub-centric names match the C# package. Transforms are **inverted** on the client:

| Fluent | Server (`ManagedDotNet.SignalR.Topics`) | Client (`@manageddotnet/signalr-client`) |
|--------|-------------------------------------------|------------------------------------------|
| `HandleOnServer` | inbound: `WithTopic` + `WithDeserializer` + `WithHandler<T>()` | outbound: `withTopic` + `withSerializer` (no handler) |
| `HandleOnClient` | outbound: `WithTopic` + `WithSerializer` | inbound: `withTopic` + `withDeserializer` + `withHandler(fn)` |

Authorization, CORS, `MapTopicHubs`, and DI are **not** mirrored — server-only.

TypeScript erases generics, so registrations take a `defineMessageType` token (the client equivalent of C# `typeof(T)`).

## Install

```bash
pnpm add @manageddotnet/signalr-client @microsoft/signalr
```

`@microsoft/signalr` is a peer dependency.

## Quick start

```ts
import {
  createTopicHubClient,
  defineMessageType,
} from "@manageddotnet/signalr-client";

type CreateChatMessageDto = {
  roomId: string;
  tracker: string;
  text?: string;
};

type ChatMessageAckDto = {
  tracker: string;
  messageId: string;
};

const CreateChatMessage = defineMessageType<CreateChatMessageDto>("CreateChatMessage");
const ChatMessageAck = defineMessageType<ChatMessageAckDto>("ChatMessageAck");

const hub = createTopicHubClient({
  getUrl: () => "https://api.example.com/ChatHub",
  getAccessToken: () => accessToken,
})
  .handleOnServer(CreateChatMessage, (cfg) =>
    cfg.withTopic("chats/messages"))
  .handleOnClient(ChatMessageAck, (cfg) =>
    cfg
      .withTopic("chats/messages/ack")
      .withHandler((ack) => {
        console.log("ack", ack.tracker, ack.messageId);
      }))
  .build();

await hub.connect();
await hub.send(CreateChatMessage, {
  roomId: "…",
  tracker: crypto.randomUUID(),
  text: "hello",
});
```

Illustrative topics match a typical ChatModule registration; this package has **no** ProjectX dependency.

## API surface

- `createTopicHubClient(options)` → fluent builder
- `handleOnServer(messageType, cfg => cfg.withTopic(…).withSerializer?(…))`
- `handleOnClient(messageType, cfg => cfg.withTopic(…).withDeserializer?(…).withHandler(…))`
- `build()` — validates topics/handlers; rejects duplicates
- `ITopicHubClient`: `connect`, `disconnect`, `state`, `send(messageType, payload)`, `invoke(topic, payload)`

Defaults: `JSON.stringify` / `JSON.parse`, automatic reconnect on.
