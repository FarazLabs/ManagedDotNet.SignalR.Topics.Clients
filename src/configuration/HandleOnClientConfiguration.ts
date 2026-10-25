import type { ClientHandler, Deserializer, MessageType } from "../types.js";

/**
 * Fluent config for one server → client topic (mirrors server HandleOnClient
 * plus a function WithHandler instead of DI).
 */
export class HandleOnClientConfiguration<T> {
  private _topic: string | undefined;
  private _deserializer: Deserializer<T> | undefined;
  private _handler: ClientHandler<T> | undefined;

  public constructor
  (
    private readonly _messageType: MessageType<T>,
  )
  {
  }

  public get messageType(): MessageType<T> {
    return this._messageType;
  }

  public get topic(): string | undefined {
    return this._topic;
  }

  public get deserializer(): Deserializer<T> | undefined {
    return this._deserializer;
  }

  public get handler(): ClientHandler<T> | undefined {
    return this._handler;
  }

  /**
   * Required — topic string matched on inbound Handle invocations.
   */
  public withTopic(topic: string): this {
    if (topic.trim().length === 0) {
      throw new Error(`WithTopic requires a non-empty topic for message type "${this._messageType.name}".`);
    }

    this._topic = topic;
    return this;
  }

  /**
   * Optional — overrides default JSON.parse as T.
   */
  public withDeserializer(deserializer: Deserializer<T>): this {
    this._deserializer = deserializer;
    return this;
  }

  /**
   * Required — function handler (client substitute for DI WithHandler&lt;T&gt;).
   */
  public withHandler(handler: ClientHandler<T>): this {
    this._handler = handler;
    return this;
  }

  public ensureIsValid(): void {
    if (this._topic === undefined || this._topic.trim().length === 0) {
      throw new Error(
        `HandleOnClient for "${this._messageType.name}" is missing WithTopic.`,
      );
    }

    if (this._handler === undefined) {
      throw new Error(
        `HandleOnClient for "${this._messageType.name}" is missing WithHandler.`,
      );
    }
  }
}
