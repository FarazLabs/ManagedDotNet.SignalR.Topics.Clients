import {
  type HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type { HandleOnClientConfiguration } from "./configuration/HandleOnClientConfiguration.js";
import type { HandleOnServerConfiguration } from "./configuration/HandleOnServerConfiguration.js";
import type { ITopicHubClient } from "./ITopicHubClient.js";
import type { MessageConstructor, TopicHubClientOptions } from "./types.js";

const HANDLE_METHOD: string = "Handle";

/**
 * HubConnection wrapper that multiplexes Handle(topic, payload) via registered bindings.
 */
export class TopicHubClient implements ITopicHubClient {
  private _connection: HubConnection | undefined;

  public constructor(
    private readonly _options: TopicHubClientOptions,
    private readonly _handleOnServerConfigurations: ReadonlyMap<
      MessageConstructor,
      HandleOnServerConfiguration<unknown>
    >,
    private readonly _handleOnClientConfigurations: ReadonlyMap<
      string,
      HandleOnClientConfiguration<unknown>
    >,
  ) {}

  public get state(): HubConnectionState {
    if (this._connection === undefined) {
      return HubConnectionState.Disconnected;
    }

    return this._connection.state;
  }

  public async connect(): Promise<void> {
    if (
      this._connection !== undefined &&
      this._connection.state !== HubConnectionState.Disconnected
    ) {
      return;
    }

    const url: string = this._options.getUrl();
    if (url.trim().length === 0) {
      throw new Error("getUrl() returned an empty hub URL.");
    }

    const connection: HubConnection =
      this._options.createHubConnection !== undefined
        ? this._options.createHubConnection(url)
        : this.createDefaultConnection(url);

    connection.on(HANDLE_METHOD, (topic: string, payload: string): void => {
      void this.dispatchInbound(topic, payload);
    });

    this._connection = connection;
    await connection.start();
  }

  public async disconnect(): Promise<void> {
    if (this._connection === undefined) {
      return;
    }

    const connection: HubConnection = this._connection;
    this._connection = undefined;
    connection.off(HANDLE_METHOD);
    await connection.stop();
  }

  public async handle(message: object): Promise<void> {
    if (message === null || typeof message !== "object") {
      throw new Error("handle() requires a class instance registered via HandleOnServer.");
    }

    const messageType: MessageConstructor = message.constructor as MessageConstructor;
    const configuration: HandleOnServerConfiguration<unknown> | undefined =
      this._handleOnServerConfigurations.get(messageType);

    if (configuration === undefined) {
      throw new Error(
        `No configuration found for outgoing message type ${messageType.name || "anonymous"}.`,
      );
    }

    const serialize =
      configuration.serializer ?? ((value: unknown): string => JSON.stringify(value));
    const wire: string = serialize(message);
    await this.invokeHandle(configuration.topic!, wire);
  }

  private async invokeHandle(topic: string, wire: string): Promise<void> {
    const connection: HubConnection = this.requireConnection();
    await connection.invoke(HANDLE_METHOD, topic, wire);
  }

  private async dispatchInbound(topic: string, payload: string): Promise<void> {
    const configuration: HandleOnClientConfiguration<unknown> | undefined =
      this._handleOnClientConfigurations.get(topic);

    if (configuration === undefined) {
      return;
    }

    try {
      const deserialize = configuration.deserializer ?? ((raw: string): unknown => JSON.parse(raw));
      const message: unknown = deserialize(payload);
      await configuration.handler!(message, { topic });
    } catch (error: unknown) {
      const detail: string = error instanceof Error ? error.message : String(error);
      console.error(
        `[ManagedDotNet.SignalR.Client] Handler for topic "${topic}" failed: ${detail}`,
      );
    }
  }

  private requireConnection(): HubConnection {
    if (this._connection === undefined) {
      throw new Error("Topic hub is not connected. Call connect() first.");
    }

    if (this._connection.state !== HubConnectionState.Connected) {
      throw new Error(`Topic hub is not connected (state=${this._connection.state}).`);
    }

    return this._connection;
  }

  private createDefaultConnection(url: string): HubConnection {
    const builder: HubConnectionBuilder = new HubConnectionBuilder()
      .withUrl(url, {
        accessTokenFactory: (): Promise<string> => {
          const token: string | null | undefined = this._options.getAccessToken?.();
          return Promise.resolve(token ?? "");
        },
      })
      .configureLogging(LogLevel.Warning);

    const reconnect: boolean = this._options.withAutomaticReconnect !== false;
    if (reconnect) {
      builder.withAutomaticReconnect();
    }

    return builder.build();
  }
}
