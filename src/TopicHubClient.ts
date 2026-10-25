import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import type { ITopicHubClient } from "./ITopicHubClient.js";
import type {
  ClientBinding,
  MessageType,
  ServerBinding,
  TopicHubClientOptions,
} from "./types.js";

const HANDLE_METHOD: string = "Handle";

/**
 * HubConnection wrapper that multiplexes Handle(topic, payload) via registered bindings.
 */
export class TopicHubClient implements ITopicHubClient {
  private _connection: HubConnection | undefined;
  private readonly _serverByTypeName: Map<string, ServerBinding> = new Map<string, ServerBinding>();
  private readonly _serverByTopic: Map<string, ServerBinding> = new Map<string, ServerBinding>();
  private readonly _clientByTopic: Map<string, ClientBinding> = new Map<string, ClientBinding>();

  public constructor
  (
    private readonly _options: TopicHubClientOptions,
    serverBindings: readonly ServerBinding[],
    clientBindings: readonly ClientBinding[],
  )
  {
    for (const binding of serverBindings) {
      this._serverByTypeName.set(binding.messageType.name, binding);
      this._serverByTopic.set(binding.topic, binding);
    }

    for (const binding of clientBindings) {
      this._clientByTopic.set(binding.topic, binding);
    }
  }

  public get state(): HubConnectionState {
    if (this._connection === undefined) {
      return HubConnectionState.Disconnected;
    }

    return this._connection.state;
  }

  public async connect(): Promise<void> {
    if (this._connection !== undefined && this._connection.state !== HubConnectionState.Disconnected) {
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

  public async send<T>(messageType: MessageType<T>, payload: T): Promise<void> {
    const binding: ServerBinding | undefined = this._serverByTypeName.get(messageType.name);
    if (binding === undefined) {
      throw new Error(`No HandleOnServer registration for message type "${messageType.name}".`);
    }

    const wire: string = binding.serialize(payload);
    await this.invokeHandle(binding.topic, wire);
  }

  public async invoke(topic: string, payload: unknown): Promise<void> {
    const binding: ServerBinding | undefined = this._serverByTopic.get(topic);
    const wire: string =
      binding !== undefined ? binding.serialize(payload) : JSON.stringify(payload);
    await this.invokeHandle(topic, wire);
  }

  private async invokeHandle(topic: string, wire: string): Promise<void> {
    const connection: HubConnection = this.requireConnection();
    await connection.invoke(HANDLE_METHOD, topic, wire);
  }

  private async dispatchInbound(topic: string, payload: string): Promise<void> {
    const binding: ClientBinding | undefined = this._clientByTopic.get(topic);
    if (binding === undefined) {
      return;
    }

    try {
      const message: unknown = binding.deserialize(payload);
      await binding.handler(message, { topic });
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
        accessTokenFactory: async (): Promise<string> => {
          const token: string | null | undefined = this._options.getAccessToken?.();
          return token ?? "";
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
