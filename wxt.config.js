import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "Feed Digest Study",
    description: "Research extension: collects feed posts from consenting participants.",
    permissions: ["storage"],
    host_permissions: ["*://*.instagram.com/*"],
  },
});
