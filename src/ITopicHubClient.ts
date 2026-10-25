import type { HubConnectionState } from "@microsoft/signalr";

/**
 * Built topic hub client: connect, handle by message class, and receive via registered handlers.
 */
export interface ITopicHubClient {
  readonly state: HubConnectionState;

  connect(): Promise<void>;

  disconnect(): Promise<void>;

  /**
   * Looks up HandleOnServerConfigurations by {@link message}'s constructor, serializes,
   * and invokes remote Handle(topic, wire) — mirrors server TopicClientProxy.Handle.
   */
  handle(message: object): Promise<void>;
}
