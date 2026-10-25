import { HubConnectionState } from "@microsoft/signalr";
import { describe, expect, it, vi } from "vitest";
import { createTopicHubClient } from "../../src/index.js";

class ChatMessage {
  public constructor(public text: string) {}
}

class PlainText {
  public constructor(public text: string) {}
}

type Inbound = { id: number };

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
    start: vi.fn((): Promise<void> => {
      connection.state = HubConnectionState.Connected;
      return Promise.resolve();
    }),
    stop: vi.fn((): Promise<void> => {
      connection.state = HubConnectionState.Disconnected;
      return Promise.resolve();
    }),
    invoke: vi.fn((_method: string, _topic: string, _payload: string): Promise<undefined> =>
      Promise.resolve(undefined),
    ),
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
  it("invokes Handle with topic and JSON payload on handle", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(ChatMessage, (cfg) => cfg.withTopic("chats/messages"))
      .build();

    await hub.connect();
    await hub.handle(new ChatMessage("hi"));

    expect(connection.invoke).toHaveBeenCalledWith(
      "Handle",
      "chats/messages",
      JSON.stringify({ text: "hi" }),
    );
  });

  it("uses custom serializer on handle", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(PlainText, (cfg) => cfg.withTopic("plain").withSerializer((m) => m.text))
      .build();

    await hub.connect();
    await hub.handle(new PlainText("raw"));

    expect(connection.invoke).toHaveBeenCalledWith("Handle", "plain", "raw");
  });

  it("throws when message class is not registered", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    }).build();

    await hub.connect();
    await expect(hub.handle(new ChatMessage("x"))).rejects.toThrow(
      /No configuration found for outgoing message type/,
    );
  });

  it("dispatches inbound Handle to the matching handler", async () => {
    const { connection, emitHandle } = createMockConnection();
    const received: Inbound[] = [];

    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnClient<Inbound>((cfg) =>
        cfg.withTopic("chats/messages/ack").withHandler((msg) => {
          received.push(msg);
        }),
      )
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
      .handleOnClient<Inbound>((cfg) =>
        cfg
          .withTopic("alert")
          .withDeserializer((raw) => ({ id: Number(raw) }))
          .withHandler((msg) => {
            received.push(msg);
          }),
      )
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
      .handleOnClient<Inbound>((cfg) => cfg.withTopic("known").withHandler(() => undefined))
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
      .handleOnClient<Inbound>((cfg) =>
        cfg.withTopic("boom").withHandler(() => {
          throw new Error("handler failed");
        }),
      )
      .build();

    await hub.connect();
    emitHandle("boom", JSON.stringify({ id: 1 }));

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("handle before connect throws", async () => {
    const { connection } = createMockConnection();
    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    })
      .handleOnServer(ChatMessage, (cfg) => cfg.withTopic("t"))
      .build();

    await expect(hub.handle(new ChatMessage("nope"))).rejects.toThrow(/not connected/);
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
