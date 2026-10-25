import { describe, expect, it, vi } from "vitest";
import { createTopicHubClient } from "../../src/index.js";

type Outbound = { value: string };
type Inbound = { id: number };

describe("TopicHubClientBuilder validation", () => {
  it("rejects empty HandleOnServer topic", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer<Outbound>("   ", () => undefined)
        .build(),
    ).toThrow(/non-empty topic/);
  });

  it("rejects empty HandleOnClient topic", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient<Inbound>("", () => undefined)
        .build(),
    ).toThrow(/non-empty topic/);
  });

  it("requires WithHandler on HandleOnClient", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient<Inbound>("in", () => undefined)
        .build(),
    ).toThrow(/missing WithHandler/);
  });

  it("rejects duplicate HandleOnServer topics", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer<Outbound>("same", () => undefined)
        .handleOnServer<Outbound>("same", () => undefined)
        .build(),
    ).toThrow(/Duplicate HandleOnServer topic/);
  });

  it("rejects duplicate HandleOnClient topics", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient<Inbound>("same", (cfg) => cfg.withHandler(() => undefined))
        .handleOnClient<Inbound>("same", (cfg) => cfg.withHandler(() => undefined))
        .build(),
    ).toThrow(/Duplicate HandleOnClient topic/);
  });

  it("builds successfully with valid server and client bindings", () => {
    const handler = vi.fn();
    const hub = createTopicHubClient({ getUrl: () => "http://localhost/hub" })
      .handleOnServer<Outbound>("out", () => undefined)
      .handleOnClient<Inbound>("in", (cfg) => cfg.withHandler(handler))
      .build();

    expect(hub).toBeDefined();
  });
});
