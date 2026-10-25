import { describe, expect, it, vi } from "vitest";
import { createTopicHubClient } from "../../src/index.js";

class OutboundA {
  public constructor
  (
    public value: string,
  )
  {
  }
}

class OutboundB {
  public constructor
  (
    public value: string,
  )
  {
  }
}

type Inbound = { id: number };

describe("TopicHubClientBuilder validation", () => {
  it("rejects empty HandleOnServer topic", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(OutboundA, (cfg) => cfg.withTopic("   "))
        .build(),
    ).toThrow(/non-empty topic/);
  });

  it("rejects missing HandleOnServer WithTopic", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(OutboundA, () => undefined)
        .build(),
    ).toThrow(/Topic is not configured/);
  });

  it("rejects empty HandleOnClient topic", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient<Inbound>((cfg) => cfg.withTopic("").withHandler(() => undefined))
        .build(),
    ).toThrow(/non-empty topic/);
  });

  it("rejects missing HandleOnClient WithTopic", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient<Inbound>((cfg) => cfg.withHandler(() => undefined))
        .build(),
    ).toThrow(/Topic is not configured/);
  });

  it("requires WithHandler on HandleOnClient", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient<Inbound>((cfg) => cfg.withTopic("in"))
        .build(),
    ).toThrow(/missing WithHandler/);
  });

  it("rejects duplicate HandleOnServer topics", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(OutboundA, (cfg) => cfg.withTopic("same"))
        .handleOnServer(OutboundB, (cfg) => cfg.withTopic("same"))
        .build(),
    ).toThrow(/Duplicate HandleOnServer topic/);
  });

  it("rejects duplicate HandleOnServer message types", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(OutboundA, (cfg) => cfg.withTopic("a"))
        .handleOnServer(OutboundA, (cfg) => cfg.withTopic("b"))
        .build(),
    ).toThrow(/Duplicate HandleOnServer message type/);
  });

  it("rejects duplicate HandleOnClient topics", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient<Inbound>((cfg) =>
          cfg.withTopic("same").withHandler(() => undefined))
        .handleOnClient<Inbound>((cfg) =>
          cfg.withTopic("same").withHandler(() => undefined))
        .build(),
    ).toThrow(/Duplicate HandleOnClient topic/);
  });

  it("builds successfully with valid server and client bindings", () => {
    const handler = vi.fn();
    const hub = createTopicHubClient({ getUrl: () => "http://localhost/hub" })
      .handleOnServer(OutboundA, (cfg) => cfg.withTopic("out"))
      .handleOnClient<Inbound>((cfg) => cfg.withTopic("in").withHandler(handler))
      .build();

    expect(hub).toBeDefined();
  });
});
