import { HttpError, HubConnectionState } from "@microsoft/signalr";
import { describe, expect, it, vi } from "vitest";
import { isUnauthorizedError, resolveAccessToken } from "../../src/accessToken.js";
import { createTopicHubClient } from "../../src/index.js";

describe("resolveAccessToken", () => {
  it("awaits rotateTokens before reading getAccessToken", async () => {
    const order: string[] = [];
    let accessToken: string | null = "stale";

    const token: string = await resolveAccessToken({
      getUrl: () => "http://localhost/hub",
      getAccessToken: (): string | null => {
        order.push("get");
        return accessToken;
      },
      rotateTokens: (): Promise<void> => {
        order.push("rotate");
        accessToken = "fresh";
        return Promise.resolve();
      },
    });

    expect(order).toEqual(["rotate", "get"]);
    expect(token).toBe("fresh");
  });

  it("returns empty string when getAccessToken is missing", async () => {
    const token: string = await resolveAccessToken({
      getUrl: () => "http://localhost/hub",
    });

    expect(token).toBe("");
  });
});

describe("isUnauthorizedError", () => {
  it("detects HttpError 401", () => {
    expect(isUnauthorizedError(new HttpError("Unauthorized", 401))).toBe(true);
  });

  it("detects nested cause with statusCode 401", () => {
    const nested: Error = new Error("wrap", { cause: new HttpError("Unauthorized", 401) });
    expect(isUnauthorizedError(nested)).toBe(true);
  });

  it("rejects other status codes", () => {
    expect(isUnauthorizedError(new HttpError("Server Error", 500))).toBe(false);
    expect(isUnauthorizedError(new Error("nope"))).toBe(false);
  });
});

describe("TopicHubClient connect 401 retry", () => {
  it("rotates once and retries start after a 401", async () => {
    const rotateTokens = vi.fn((): Promise<void> => Promise.resolve());
    let attempts = 0;

    const connection = {
      state: HubConnectionState.Disconnected,
      start: vi.fn((): Promise<void> => {
        attempts += 1;
        if (attempts === 1) {
          return Promise.reject(new HttpError("Unauthorized", 401));
        }

        connection.state = HubConnectionState.Connected;
        return Promise.resolve();
      }),
      stop: vi.fn((): Promise<void> => {
        connection.state = HubConnectionState.Disconnected;
        return Promise.resolve();
      }),
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      getAccessToken: () => "tok",
      rotateTokens,
      createHubConnection: () => connection as never,
    }).build();

    await hub.connect();

    expect(rotateTokens).toHaveBeenCalledTimes(1);
    expect(connection.start).toHaveBeenCalledTimes(2);
    expect(hub.state).toBe(HubConnectionState.Connected);
  });

  it("does not rotate on non-401 connect failure", async () => {
    const rotateTokens = vi.fn((): Promise<void> => Promise.resolve());

    const connection = {
      state: HubConnectionState.Disconnected,
      start: vi.fn((): Promise<void> => Promise.reject(new HttpError("Server Error", 500))),
      stop: vi.fn(),
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      rotateTokens,
      createHubConnection: () => connection as never,
    }).build();

    await expect(hub.connect()).rejects.toBeInstanceOf(HttpError);
    expect(rotateTokens).not.toHaveBeenCalled();
    expect(connection.start).toHaveBeenCalledTimes(1);
  });

  it("rethrows 401 when rotateTokens is not provided", async () => {
    const connection = {
      state: HubConnectionState.Disconnected,
      start: vi.fn((): Promise<void> => Promise.reject(new HttpError("Unauthorized", 401))),
      stop: vi.fn(),
      invoke: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    const hub = createTopicHubClient({
      getUrl: () => "http://localhost/hub",
      createHubConnection: () => connection as never,
    }).build();

    await expect(hub.connect()).rejects.toMatchObject({ statusCode: 401 });
    expect(connection.start).toHaveBeenCalledTimes(1);
  });
});
