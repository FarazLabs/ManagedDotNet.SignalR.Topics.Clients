import type { HubConnectionState } from "@microsoft/signalr";

/**
 * Built topic hub client: connect, send by topic, and receive via registered handlers.
 */
export interface ITopicHubClient {
  readonly state: HubConnectionState;

  connect(): Promise<void>;

  disconnect(): Promise<void>;

  /**
   * Serializes and invokes Handle(topic, payload). Uses the HandleOnServer serializer
   * registered for {@link topic} when present; otherwise JSON.stringify.
   */
  send(topic: string, payload: unknown): Promise<void>;
}
