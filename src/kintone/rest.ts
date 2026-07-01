import { KintoneRestAPIClient } from "@kintone/rest-api-client";

// One client per page load. rest-api-client builds guest-space aware URLs, so
// paths are never assembled by hand (common spec section 5).
let client: KintoneRestAPIClient | null = null;

export function getClient(): KintoneRestAPIClient {
  if (!client) {
    client = new KintoneRestAPIClient();
  }
  return client;
}
