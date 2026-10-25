import { TopicHubClient } from "../TopicHubClient.js";
import type { ITopicHubClient } from "../ITopicHubClient.js";
import type {
  ClientBinding,
  ServerBinding,
  TopicHubClientOptions,
} from "../types.js";
import { HandleOnClientConfiguration } from "./HandleOnClientConfiguration.js";
import { HandleOnServerConfiguration } from "./HandleOnServerConfiguration.js";

type ServerConfigure<T> = (cfg: HandleOnServerConfiguration<T>) => void;
type ClientConfigure<T> = (cfg: HandleOnClientConfiguration<T>) => void;

function defaultSerialize<T>(message: T): string {
  return JSON.stringify(message);
}

function defaultDeserialize<T>(payload: string): T {
  return JSON.parse(payload) as T;
}

/**
 * Fluent builder mirroring ManagedDotNet.SignalR.Topics AddTopicHub configuration.
 * Topic strings are the runtime registry keys; generics type payloads only.
 */
export class TopicHubClientBuilder {
  private readonly _serverConfigs: HandleOnServerConfiguration<unknown>[] = [];
  private readonly _clientConfigs: HandleOnClientConfiguration<unknown>[] = [];

  public constructor
  (
    private readonly _options: TopicHubClientOptions,
  )
  {
  }

  /**
   * Registers a client → server binding (serialize + invoke Handle).
   */
  public handleOnServer<T>
  (
    topic: string,
    configure: ServerConfigure<T>,
  ): this
  {
    const cfg: HandleOnServerConfiguration<T> = new HandleOnServerConfiguration<T>(topic);
    configure(cfg);
    this._serverConfigs.push(cfg as HandleOnServerConfiguration<unknown>);
    return this;
  }

  /**
   * Registers a server → client binding (deserialize + function handler).
   */
  public handleOnClient<T>
  (
    topic: string,
    configure: ClientConfigure<T>,
  ): this
  {
    const cfg: HandleOnClientConfiguration<T> = new HandleOnClientConfiguration<T>(topic);
    configure(cfg);
    this._clientConfigs.push(cfg as HandleOnClientConfiguration<unknown>);
    return this;
  }

  /**
   * Validates bindings and returns a ready {@link ITopicHubClient}.
   */
  public build(): ITopicHubClient {
    const serverBindings: ServerBinding[] = [];
    const clientBindings: ClientBinding[] = [];

    const serverTopics: Set<string> = new Set<string>();
    const clientTopics: Set<string> = new Set<string>();

    for (const cfg of this._serverConfigs) {
      cfg.ensureIsValid();
      const topic: string = cfg.topic;

      if (serverTopics.has(topic)) {
        throw new Error(`Duplicate HandleOnServer topic "${topic}".`);
      }

      serverTopics.add(topic);

      serverBindings.push({
        topic,
        serialize: (cfg.serializer ?? defaultSerialize) as (message: unknown) => string,
      });
    }

    for (const cfg of this._clientConfigs) {
      cfg.ensureIsValid();
      const topic: string = cfg.topic;

      if (clientTopics.has(topic)) {
        throw new Error(`Duplicate HandleOnClient topic "${topic}".`);
      }

      clientTopics.add(topic);

      clientBindings.push({
        topic,
        deserialize: (cfg.deserializer ?? defaultDeserialize) as (payload: string) => unknown,
        handler: cfg.handler!,
      });
    }

    return new TopicHubClient(this._options, serverBindings, clientBindings);
  }
}
