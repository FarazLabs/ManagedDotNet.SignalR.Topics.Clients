import type { HubConnectionState } from "@microsoft/signalr";
import type { MessageType } from "./types.js";

/**
 * Built topic hub client: connect, send by message type, and receive via registered handlers.
 */
export interface ITopicHubClient {
  readonly state: HubConnectionState;

  connect(): Promise<void>;

  disconnect(): Promise<void>;

  /**
   * Serializes and invokes Handle(topic, payload) using the HandleOnServer binding for {@link messageType}.
   */
  send<T>(messageType: MessageType<T>, payload: T): Promise<void>;

  /**
   * Escape hatch: invoke Handle with an explicit topic. Uses the HandleOnServer serializer
   * registered for that topic when present; otherwise JSON.stringify.
   */
  invoke(topic: string, payload: unknown): Promise<void>;
}
