import type { MessageConstructor, Serializer } from "../types.js";

/**
 * Fluent config for one client → server binding (mirrors server HandleOnServer,
 * with WithSerializer instead of WithDeserializer / WithHandler).
 */
export class HandleOnServerConfiguration<T> {
  private _topic: string | undefined;
  private _serializer: Serializer<T> | undefined;

  public constructor(private readonly _messageType: MessageConstructor<T>) {}

  public get messageType(): MessageConstructor<T> {
    return this._messageType;
  }

  public get topic(): string | undefined {
    return this._topic;
  }

  public get serializer(): Serializer<T> | undefined {
    return this._serializer;
  }

  /**
   * Required — sets the wire topic for remote Handle(topic, payload).
   */
  public withTopic(topic: string): this {
    if (topic.trim().length === 0) {
      throw new Error("HandleOnServer requires a non-empty topic.");
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
      const name: string = this._messageType.name || "anonymous";
      throw new Error(
        `Topic is not configured for message type '${name}'.\n` +
          `Use .withTopic("your-topic") to bind the message type (${name}) to a specific topic.`,
      );
    }
  }
}
