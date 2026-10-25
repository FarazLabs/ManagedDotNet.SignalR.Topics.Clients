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
 * Runtime message class used as the HandleOnServer registry key.
 */
export type MessageConstructor<T = unknown> = abstract new (...args: never[]) => T;

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
