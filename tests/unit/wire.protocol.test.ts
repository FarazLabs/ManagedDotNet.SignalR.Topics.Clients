import { HubConnectionState } from "@microsoft/signalr";
import { describe, expect, it, vi } from "vitest";
import { createTopicHubClient, defineMessageType } from "../../src/index.js";

type Outbound = { text: string };
type Inbound = { id: number };

const Out = defineMessageType<Outbound>("Out");
const In = defineMessageType<Inbound>("In");

type HandleListener = (topic: string, payload: string) => void;

function createMockConnection(): {
  connection: {
    state: HubConnectionState;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    invoke: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
  };
  emitHandle: (topic: string, payload: string) => void;
} {
  let listener: HandleListener | undefined;
  const connection = {
    state: HubConnectionState.Disconnected,
    start: vi.fn(async () => {
      connection.state = HubConnectionState.Connected;
    }),
    stop: vi.fn(async () => {
      connection.state = HubConnectionState.Disconnected;
    }),
    invoke: vi.fn(async (_method: string, _topic: string, _payload: string) => undefined),
    on: vi.fn((method: string, handler: HandleListener) => {
      if (method === "Handle") {
        listener = handler;
      }
    }),
    off: vi.fn((method: string) => {
      if (method === "Handle") {
        listener = undefined;
      }
    }),
  };

  return {
    connection,
    emitHandle: (topic: string, payload: string): void => {
      if (listener === undefined) {
        throw new Error("No Handle listener registered");
      }
      listener(topic, payload);
    },
  };
}

describe("TopicHubClient wire protocol", () => {
  it("invokes Handle with topic and JSON payload on send", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(Out, (cfg) => cfg.withTopic("chats/messages"))
      .build();

    await hub.connect();
    await hub.send(Out, { text: "hi" });

    expect(connection.invoke).toHaveBeenCalledWith(
      "Handle",
      "chats/messages",
      JSON.stringify({ text: "hi" }),
    );
  });

  it("uses custom serializer on send", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(Out, (cfg) =>
        cfg.withTopic("plain").withSerializer((m) => m.text))
      .build();

    await hub.connect();
    await hub.send(Out, { text: "raw" });

    expect(connection.invoke).toHaveBeenCalledWith("Handle", "plain", "raw");
  });

  it("dispatches inbound Handle to the matching handler", async () => {
    const { connection, emitHandle } = createMockConnection();
    const received: Inbound[] = [];

    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnClient(In, (cfg) =>
        cfg.withTopic("chats/messages/ack").withHandler((msg) => {
          received.push(msg);
        }))
      .build();

    await hub.connect();
    emitHandle("chats/messages/ack", JSON.stringify({ id: 42 }));

    expect(received).toEqual([{ id: 42 }]);
  });

  it("uses custom deserializer on inbound", async () => {
    const { connection, emitHandle } = createMockConnection();
    const received: Inbound[] = [];

    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnClient(In, (cfg) =>
        cfg
          .withTopic("alert")
          .withDeserializer((raw) => ({ id: Number(raw) }))
          .withHandler((msg) => {
            received.push(msg);
          }))
      .build();

    await hub.connect();
    emitHandle("alert", "7");

    expect(received).toEqual([{ id: 7 }]);
  });

  it("ignores unknown inbound topics", async () => {
    const { connection, emitHandle } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnClient(In, (cfg) => cfg.withTopic("known").withHandler(() => undefined))
      .build();

    await hub.connect();
    expect(() => emitHandle("unknown", "{}")).not.toThrow();
  });

  it("swallows handler errors so the listener stays alive", async () => {
    const { connection, emitHandle } = createMockConnection();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnClient(In, (cfg) =>
        cfg.withTopic("boom").withHandler(() => {
          throw new Error("handler failed");
        }))
      .build();

    await hub.connect();
    emitHandle("boom", JSON.stringify({ id: 1 }));

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("invoke uses topic serializer when registered", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(Out, (cfg) =>
        cfg.withTopic("t").withSerializer((m) => `x:${m.text}`))
      .build();

    await hub.connect();
    await hub.invoke("t", { text: "a" });

    expect(connection.invoke).toHaveBeenCalledWith("Handle", "t", "x:a");
  });

  it("send before connect throws", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(Out, (cfg) => cfg.withTopic("t"))
      .build();

    await expect(hub.send(Out, { text: "nope" })).rejects.toThrow(/not connected/);
  });

  it("send with unknown message type throws", async () => {
    const { connection } = createMockConnection();
    const Unknown = defineMessageType<Outbound>("Unknown");
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(Out, (cfg) => cfg.withTopic("t"))
      .build();

    await hub.connect();
    await expect(hub.send(Unknown, { text: "x" })).rejects.toThrow(/No HandleOnServer/);
  });

  it("disconnect stops the connection", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    }).build();

    await hub.connect();
    expect(hub.state).toBe(HubConnectionState.Connected);
    await hub.disconnect();
    expect(connection.stop).toHaveBeenCalled();
    expect(hub.state).toBe(HubConnectionState.Disconnected);
  });
});
