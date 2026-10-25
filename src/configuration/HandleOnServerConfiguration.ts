import type { Serializer } from "../types.js";

/**
 * Fluent config for one client → server topic (mirrors server HandleOnServer,
 * with WithSerializer instead of WithDeserializer / WithHandler).
 * Topic is supplied to handleOnServer as the first argument.
 */
export class HandleOnServerConfiguration<T> {
  private _serializer: Serializer<T> | undefined;

  public constructor
  (
    private readonly _topic: string,
  )
  {
    if (_topic.trim().length === 0) {
      throw new Error("HandleOnServer requires a non-empty topic.");
    }
  }

  public get topic(): string {
    return this._topic;
  }

  public get serializer(): Serializer<T> | undefined {
    return this._serializer;
  }

  /**
   * Optional — overrides default JSON.stringify.
   */
  public withSerializer(serializer: Serializer<T>): this {
    this._serializer = serializer;
    return this;
  }

  public ensureIsValid(): void {
    // Topic is validated in the constructor.
  }
}
