import { TopicHubClientBuilder } from "./configuration/TopicHubClientBuilder.js";
import type { TopicHubClientOptions } from "./types.js";

/**
 * Starts a fluent topic-hub client builder (client twin of AddTopicHub).
 */
export function createTopicHubClient(options: TopicHubClientOptions): TopicHubClientBuilder {
  if (options.getUrl === undefined) {
    throw new Error("createTopicHubClient requires getUrl.");
  }

  return new TopicHubClientBuilder(options);
}
