import type { MessageType, Serializer } from "../types.js";

/**
 * Fluent config for one client → server topic (mirrors server HandleOnServer,
 * with WithSerializer instead of WithDeserializer / WithHandler).
 */
export class HandleOnServerConfiguration<T> {
  private _topic: string | undefined;
  private _serializer: Serializer<T> | undefined;

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

  public get serializer(): Serializer<T> | undefined {
    return this._serializer;
  }

  /**
   * Required — topic string passed as the first Handle argument.
   */
  public withTopic(topic: string): this {
    if (topic.trim().length === 0) {
      throw new Error(`WithTopic requires a non-empty topic for message type "${this._messageType.name}".`);
    }

    this._topic = topic;
    return this;
  }

  /**
   * Optional — overrides default JSON.stringify.
   */
  public withSerializer(serializer: Serializer<T>): this {
    this._serializer = serializer;
    return this;
  }

  public ensureIsValid(): void {
    if (this._topic === undefined || this._topic.trim().length === 0) {
      throw new Error(
        `HandleOnServer for "${this._messageType.name}" is missing WithTopic.`,
      );
    }
  }
}
