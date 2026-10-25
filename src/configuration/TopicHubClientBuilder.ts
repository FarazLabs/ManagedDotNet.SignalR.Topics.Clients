import { TopicHubClient } from "../TopicHubClient.js";
import type { ITopicHubClient } from "../ITopicHubClient.js";
import type { MessageConstructor, TopicHubClientOptions } from "../types.js";
import { HandleOnClientConfiguration } from "./HandleOnClientConfiguration.js";
import { HandleOnServerConfiguration } from "./HandleOnServerConfiguration.js";

type ServerConfigure<T> = (cfg: HandleOnServerConfiguration<T>) => void;
type ClientConfigure<T> = (cfg: HandleOnClientConfiguration<T>) => void;

/**
 * Fluent builder mirroring ManagedDotNet.SignalR.Topics AddTopicHub configuration.
 * Outbound bindings key by message class; inbound bindings key by topic string.
 */
export class TopicHubClientBuilder {
  private readonly _handleOnServerConfigurations: HandleOnServerConfiguration<unknown>[] = [];
  private readonly _handleOnClientConfigurations: HandleOnClientConfiguration<unknown>[] = [];

  public constructor
  (
    private readonly _options: TopicHubClientOptions,
  )
  {
  }

  /**
   * Registers a client → server binding (class → WithTopic + serialize + invoke Handle).
   */
  public handleOnServer<T>
  (
    messageType: MessageConstructor<T>,
    configure: ServerConfigure<T>,
  ): this
  {
    const cfg: HandleOnServerConfiguration<T> = new HandleOnServerConfiguration<T>(messageType);
    configure(cfg);
    cfg.ensureIsValid();
    this._handleOnServerConfigurations.push(cfg as HandleOnServerConfiguration<unknown>);
    return this;
  }

  /**
   * Registers a server → client binding (WithTopic + deserialize + function handler).
   */
  public handleOnClient<T>
  (
    configure: ClientConfigure<T>,
  ): this
  {
    const cfg: HandleOnClientConfiguration<T> = new HandleOnClientConfiguration<T>();
    configure(cfg);
    cfg.ensureIsValid();
    this._handleOnClientConfigurations.push(cfg as HandleOnClientConfiguration<unknown>);
    return this;
  }

  /**
   * Validates bindings and returns a ready {@link ITopicHubClient}.
   */
  public build(): ITopicHubClient {
    const handleOnServerConfigurations: Map<MessageConstructor, HandleOnServerConfiguration<unknown>> =
      new Map<MessageConstructor, HandleOnServerConfiguration<unknown>>();
    const handleOnClientConfigurations: Map<string, HandleOnClientConfiguration<unknown>> =
      new Map<string, HandleOnClientConfiguration<unknown>>();

    const serverTopics: Set<string> = new Set<string>();

    for (const cfg of this._handleOnServerConfigurations) {
      const topic: string = cfg.topic!;
      const messageType: MessageConstructor = cfg.messageType;

      if (serverTopics.has(topic)) {
        throw new Error(`Duplicate HandleOnServer topic "${topic}".`);
      }

      if (handleOnServerConfigurations.has(messageType)) {
        throw new Error(
          `Duplicate HandleOnServer message type "${messageType.name || "anonymous"}".`,
        );
      }

      serverTopics.add(topic);
      handleOnServerConfigurations.set(messageType, cfg);
    }

    for (const cfg of this._handleOnClientConfigurations) {
      const topic: string = cfg.topic!;

      if (handleOnClientConfigurations.has(topic)) {
        throw new Error(`Duplicate HandleOnClient topic "${topic}".`);
      }

      handleOnClientConfigurations.set(topic, cfg);
    }

    return new TopicHubClient(
      this._options,
      handleOnServerConfigurations,
      handleOnClientConfigurations,
    );
  }
}
