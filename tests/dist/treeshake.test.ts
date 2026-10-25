import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  assertDistBuilt,
  bundleWithEsbuild,
  bundleWithRollup,
  consumer,
  DIST_ESM,
} from "./bundlers.js";

/**
 * Tree-shaking guard. It runs against the BUILT package (dist/), exactly what a
 * consumer's bundler sees, and checks three things:
 *
 *  1. package.json / dist are shakeable (sideEffects: false, no runtime signalr import in configs).
 *  2. Importing ONE export pulls in only the code that export needs (marker strings).
 *  3. The minified single-export bundle stays under a byte budget.
 *
 * When you add or change a public runtime export, this file tells you what to update.
 */

/** Strings that only exist in one feature's code; used to detect what got bundled. */
const MARKERS = {
  getUrl: "createTopicHubClient requires getUrl.",
  emptyHub: "getUrl() returned an empty hub URL.",
  handleInstance: "handle() requires a class instance registered via HandleOnServer.",
  missingOutgoing: "No configuration found for outgoing message type",
  notConnected: "Topic hub is not connected. Call connect() first.",
  handlerFailed: "[ManagedDotNet.SignalR.Client]",
  dupServerTopic: "Duplicate HandleOnServer topic",
  dupServerType: "Duplicate HandleOnServer message type",
  dupClientTopic: "Duplicate HandleOnClient topic",
  serverEmptyTopic: "HandleOnServer requires a non-empty topic.",
  serverTopicMissing: 'Use .withTopic("your-topic") to bind the message type',
  clientEmptyTopic: "HandleOnClient requires a non-empty topic.",
  clientTopicMissing: "Topic is not configured for HandleOnClient.",
  missingHandler: "missing WithHandler",
} as const;

type Marker = keyof typeof MARKERS;

const EVERYTHING: readonly Marker[] = [
  "getUrl",
  "emptyHub",
  "handleInstance",
  "missingOutgoing",
  "notConnected",
  "handlerFailed",
  "dupServerTopic",
  "dupServerType",
  "dupClientTopic",
  "serverEmptyTopic",
  "serverTopicMissing",
  "clientEmptyTopic",
  "clientTopicMissing",
  "missingHandler",
];

interface Expectation {
  /** Exactly these markers must be present in the bundle of this export alone. */
  markers: readonly Marker[];
  /** Minified esbuild bundle size ceiling in bytes (measured size + ~30% headroom). */
  maxBytes: number;
}

const EXPECTED: Record<string, Expectation> = {
  HandleOnServerConfiguration: {
    markers: ["serverEmptyTopic", "serverTopicMissing"],
    maxBytes: 900,
  },
  HandleOnClientConfiguration: {
    markers: ["clientEmptyTopic", "clientTopicMissing", "missingHandler"],
    maxBytes: 1100,
  },
  TopicHubClient: {
    markers: ["emptyHub", "handleInstance", "missingOutgoing", "notConnected", "handlerFailed"],
    maxBytes: 2800,
  },
  TopicHubClientBuilder: { markers: EVERYTHING.filter((m) => m !== "getUrl"), maxBytes: 4500 },
  createTopicHubClient: { markers: EVERYTHING, maxBytes: 4600 },
};

function presentMarkers(code: string): Marker[] {
  return (Object.keys(MARKERS) as Marker[]).filter((key: Marker): boolean =>
    code.includes(MARKERS[key]),
  );
}

function sorted<T extends string>(items: readonly T[]): T[] {
  return [...items].sort();
}

let runtimeExports: string[] = [];

beforeAll(async (): Promise<void> => {
  assertDistBuilt();
  const namespace = (await import(/* @vite-ignore */ DIST_ESM)) as Record<string, unknown>;
  runtimeExports = Object.keys(namespace).sort();
});

describe("package is shakeable", () => {
  it('declares "sideEffects": false', () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as {
      sideEffects?: unknown;
    };
    expect(pkg.sideEffects).toBe(false);
  });

  it("ships ESM that never imports @microsoft/signalr except as a peer", () => {
    const esm: string = readFileSync(DIST_ESM, "utf8");
    expect(esm).toMatch(/from\s+["']@microsoft\/signalr["']/);
    expect(esm).not.toMatch(/\brequire\(/);
  });

  it("has an expectation entry for every public runtime export (and no stale ones)", () => {
    expect(runtimeExports).toEqual(Object.keys(EXPECTED).sort());
  });
});

describe("importing nothing", () => {
  it("leaves no local code behind without trusting sideEffects (peer import only)", async () => {
    const code: string = (await bundleWithRollup(consumer([]))).trim();
    expect(code.replace(/\s/g, "")).toMatch(/^import["']@microsoft\/signalr["'];?$/);
  });

  it("leaves no code behind with esbuild either", async () => {
    const code: string = (await bundleWithEsbuild(consumer([]))).trim();
    expect(code).toBe("");
  });
});

describe("importing a single export", () => {
  it.each(Object.entries(EXPECTED))(
    "%s bundles only what it needs",
    async (name: string, expectation: Expectation): Promise<void> => {
      const minified: string = await bundleWithEsbuild(consumer([name]));
      const rollupOut: string = await bundleWithRollup(consumer([name]));

      expect(sorted(presentMarkers(minified)), `esbuild bundle of ${name}`).toEqual(
        sorted(expectation.markers),
      );
      expect(sorted(presentMarkers(rollupOut)), `rollup bundle of ${name}`).toEqual(
        sorted(expectation.markers),
      );
      expect(minified.length, `${name} minified bytes`).toBeLessThanOrEqual(expectation.maxBytes);
    },
  );

  it("sanity: the factory really contains every marker (markers are not stale)", async () => {
    const code: string = await bundleWithEsbuild(consumer(["createTopicHubClient"]));
    expect(sorted(presentMarkers(code))).toEqual(sorted(EVERYTHING));
  });

  it("sanity: a config class is far smaller than the factory", async () => {
    const small: string = await bundleWithEsbuild(consumer(["HandleOnServerConfiguration"]));
    const full: string = await bundleWithEsbuild(consumer(["createTopicHubClient"]));
    expect(small.length * 3).toBeLessThan(full.length);
  });
});

describe("importing several exports", () => {
  it("is additive: config classes do not pull in the hub runtime", async () => {
    const code: string = await bundleWithEsbuild(
      consumer(["HandleOnServerConfiguration", "HandleOnClientConfiguration"]),
    );
    expect(sorted(presentMarkers(code))).toEqual(
      sorted([
        "serverEmptyTopic",
        "serverTopicMissing",
        "clientEmptyTopic",
        "clientTopicMissing",
        "missingHandler",
      ]),
    );
  });
});
