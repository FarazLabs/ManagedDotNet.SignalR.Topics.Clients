import type { ClientHandler, Deserializer } from "../types.js";

/**
 * Fluent config for one server → client topic (mirrors server HandleOnClient
 * plus a function WithHandler instead of DI).
 * Topic is supplied to handleOnClient as the first argument.
 */
export class HandleOnClientConfiguration<T> {
  private _deserializer: Deserializer<T> | undefined;
  private _handler: ClientHandler<T> | undefined;

  public constructor
  (
    private readonly _topic: string,
  )
  {
    if (_topic.trim().length === 0) {
      throw new Error("HandleOnClient requires a non-empty topic.");
    }
  }

  public get topic(): string {
    return this._topic;
  }

  public get deserializer(): Deserializer<T> | undefined {
    return this._deserializer;
  }

  public get handler(): ClientHandler<T> | undefined {
    return this._handler;
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
    if (this._handler === undefined) {
      throw new Error(
        `HandleOnClient for topic "${this._topic}" is missing WithHandler.`,
      );
    }
  }
}
