/**
 * Runtime token for a message type. TypeScript erases generics, so this is the
 * client equivalent of C# `typeof(T)` when registering HandleOnServer / HandleOnClient.
 */
export type MessageType<T = unknown> = {
  readonly name: string;
  readonly __message?: T;
};

/**
 * Creates a {@link MessageType} token used as the registry key for send / handlers.
 */
export function defineMessageType<T>(name: string): MessageType<T> {
  if (name.trim().length === 0) {
    throw new Error("Message type name must be a non-empty string.");
  }

  return { name };
}

/**
 * Context passed to inbound (HandleOnClient) handlers.
 */
export type ClientHandlerContext = {
  topic: string;
};

/**
 * Inbound handler: deserialized payload plus topic context.
 */
export type ClientHandler<T> = (
  message: T,
  context: ClientHandlerContext,
) => void | Promise<void>;

/**
 * Serializes an outbound payload to the wire string.
 */
export type Serializer<T> = (message: T) => string;

/**
 * Deserializes an inbound wire string to T.
 */
export type Deserializer<T> = (payload: string) => T;

/**
 * Options for {@link createTopicHubClient}.
 */
export type TopicHubClientOptions = {
  /**
   * Absolute hub URL (e.g. `https://api.example.com/ChatHub`).
   * Invoked on each connect so host globals apply immediately.
   */
  getUrl: () => string;

  /**
   * Access token for SignalR `accessTokenFactory`, or null/undefined when unauthenticated.
   */
  getAccessToken?: () => string | null | undefined;

  /**
   * When true (default), enables `withAutomaticReconnect()` on the hub connection.
   */
  withAutomaticReconnect?: boolean;

  /**
   * Test seam: supply a pre-built connection instead of HubConnectionBuilder.
   */
  createHubConnection?: (url: string) => import("@microsoft/signalr").HubConnection;
};

/**
 * Frozen outbound (client → server) binding after build().
 */
export type ServerBinding<T = unknown> = {
  messageType: MessageType<T>;
  topic: string;
  serialize: Serializer<T>;
};

/**
 * Frozen inbound (server → client) binding after build().
 */
export type ClientBinding<T = unknown> = {
  messageType: MessageType<T>;
  topic: string;
  deserialize: Deserializer<T>;
  handler: ClientHandler<T>;
};
