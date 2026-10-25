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
  topic: string;
  serialize: Serializer<T>;
};

/**
 * Frozen inbound (server → client) binding after build().
 */
export type ClientBinding<T = unknown> = {
  topic: string;
  deserialize: Deserializer<T>;
  handler: ClientHandler<T>;
};
