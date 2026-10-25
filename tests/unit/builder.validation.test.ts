import { describe, expect, it, vi } from "vitest";
import { createTopicHubClient, defineMessageType } from "../../src/index.js";

type Outbound = { value: string };
type Inbound = { id: number };

const Out = defineMessageType<Outbound>("Out");
const In = defineMessageType<Inbound>("In");

describe("TopicHubClientBuilder validation", () => {
  it("requires WithTopic on HandleOnServer", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(Out, () => {
          /* missing withTopic */
        })
        .build(),
    ).toThrow(/missing WithTopic/);
  });

  it("requires WithTopic and WithHandler on HandleOnClient", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient(In, (cfg) => cfg.withTopic("in"))
        .build(),
    ).toThrow(/missing WithHandler/);
  });

  it("rejects duplicate HandleOnServer topics", () => {
    const Other = defineMessageType<Outbound>("Other");
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(Out, (cfg) => cfg.withTopic("same"))
        .handleOnServer(Other, (cfg) => cfg.withTopic("same"))
        .build(),
    ).toThrow(/Duplicate HandleOnServer topic/);
  });

  it("rejects duplicate HandleOnServer message types", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(Out, (cfg) => cfg.withTopic("a"))
        .handleOnServer(Out, (cfg) => cfg.withTopic("b"))
        .build(),
    ).toThrow(/Duplicate HandleOnServer message type/);
  });

  it("rejects duplicate HandleOnClient topics", () => {
    const Other = defineMessageType<Inbound>("OtherIn");
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnClient(In, (cfg) => cfg.withTopic("same").withHandler(() => undefined))
        .handleOnClient(Other, (cfg) => cfg.withTopic("same").withHandler(() => undefined))
        .build(),
    ).toThrow(/Duplicate HandleOnClient topic/);
  });

  it("rejects empty topic strings", () => {
    expect(() =>
      createTopicHubClient({ getUrl: () => "http://localhost/hub" })
        .handleOnServer(Out, (cfg) => cfg.withTopic("   "))
        .build(),
    ).toThrow(/non-empty topic/);
  });

  it("rejects empty message type names", () => {
    expect(() => defineMessageType("")).toThrow(/non-empty/);
  });

  it("builds successfully with valid server and client bindings", () => {
    const handler = vi.fn();
    const hub = createTopicHubClient({ getUrl: () => "http://localhost/hub" })
      .handleOnServer(Out, (cfg) => cfg.withTopic("out"))
      .handleOnClient(In, (cfg) => cfg.withTopic("in").withHandler(handler))
      .build();

    expect(hub).toBeDefined();
  });
});
