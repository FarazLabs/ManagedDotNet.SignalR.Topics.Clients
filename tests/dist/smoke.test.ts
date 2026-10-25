import { HubConnectionState } from "@microsoft/signalr";
import { createRequire } from "node:module";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "../../src/index.js";
import { assertDistBuilt, DIST_CJS, DIST_ESM } from "./bundlers.js";

/** The built package must expose the same runtime API in ESM and CJS, and actually work. */

const EXPECTED_RUNTIME_EXPORTS: readonly string[] = [
  "HandleOnClientConfiguration",
  "HandleOnServerConfiguration",
  "TopicHubClient",
  "TopicHubClientBuilder",
  "createTopicHubClient",
];

type Api = typeof ApiModule;

class ChatMessage {
  public readonly text: string;

  public constructor(text: string) {
    this.text = text;
  }
}

let esm: Api;
let cjs: Api;

beforeAll(async (): Promise<void> => {
  assertDistBuilt();
  esm = (await import(/* @vite-ignore */ DIST_ESM)) as Api;
  cjs = createRequire(import.meta.url)(DIST_CJS) as Api;
});

describe("built package", () => {
  it("exposes the documented runtime API (ESM)", () => {
    expect(Object.keys(esm).sort()).toEqual([...EXPECTED_RUNTIME_EXPORTS].sort());
  });

  it("exposes the same runtime API from CJS", () => {
    expect(Object.keys(cjs).sort()).toEqual(Object.keys(esm).sort());
  });

  it.each(["esm", "cjs"] as const)("%s build works end to end", async (flavor) => {
    const api: Api = flavor === "esm" ? esm : cjs;
    const invoke = vi.fn((): Promise<undefined> => Promise.resolve(undefined));
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
      invoke,
      on: vi.fn(),
      off: vi.fn(),
    };

    const hub = api
      .createTopicHubClient({
        getUrl: () => "http://localhost/hub",
        createHubConnection: () => connection as never,
      })
      .handleOnServer(ChatMessage, (cfg) => cfg.withTopic("chats/messages"))
      .build();

    await hub.connect();
    await hub.handle(new ChatMessage("hi"));

    expect(invoke).toHaveBeenCalledWith("Handle", "chats/messages", JSON.stringify({ text: "hi" }));
  });

  it("keeps class identity usable with instanceof in both builds", () => {
    for (const api of [esm, cjs]) {
      expect(new api.HandleOnClientConfiguration()).toBeInstanceOf(api.HandleOnClientConfiguration);
      expect(api.createTopicHubClient({ getUrl: () => "http://localhost/hub" })).toBeInstanceOf(
        api.TopicHubClientBuilder,
      );
    }
  });
});
