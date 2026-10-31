import { instagramAdapter as adapter } from "../utils/instagram.js";
import { sha256 } from "../utils/hash.js";

export default defineContentScript({
  matches: ["*://*.instagram.com/*"],

  async main() {
    const { consented, paused } = await chrome.storage.local.get(["consented", "paused"]);
    if (!consented || paused) return;

    const sessionId = crypto.randomUUID();
    const seen = new Set();
    let position = 0;

    const io = new IntersectionObserver(
      async (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!adapter.isFeedPage()) continue;

          const parsed = adapter.parse(entry.target, position + 1, sessionId);
          io.unobserve(entry.target);
          if (!parsed) continue;

          const postId =
            parsed.postId || (await sha256(parsed.rawAuthor + parsed.caption.slice(0, 100)));
          if (seen.has(postId)) continue;

          seen.add(postId);
          position++;

          const { rawAuthor, ...rest } = parsed;
          const post = { ...rest, postId, position, author: await sha256(rawAuthor) };
          chrome.runtime.sendMessage({ type: "POST_SEEN", post });
        }
      },
      { threshold: 0.6 }
    );

    const scan = () => {
      if (!adapter.isFeedPage()) return;
      document.querySelectorAll(adapter.postSelector).forEach((el) => io.observe(el));
    };

    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
    scan();
  },
});