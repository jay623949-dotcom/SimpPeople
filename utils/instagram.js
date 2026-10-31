const SPONSORED_WORDS = ["sponsored", "ad", "paid partnership"];

export const instagramAdapter = {
  platform: "instagram",
  postSelector: "article",

  // Collect only on the home feed
  isFeedPage() {
    return location.pathname === "/";
  },

  parse(el, position, sessionId) {
    // Permalink -> shortcode
    const linkEl = el.querySelector('a[href*="/p/"], a[href*="/reel/"]');
    const href = linkEl?.getAttribute("href") ?? "";
    const match = href.match(/\/(p|reel)\/([\w-]+)/);
    const shortcode = match?.[2] ?? "";
    const isReel = match?.[1] === "reel";

    // Author
    const header = el.querySelector("header");
    let rawAuthor = "";
    header?.querySelectorAll("a[href]").forEach((a) => {
      if (rawAuthor) return;
      const m = a.getAttribute("href")?.match(/^\/([A-Za-z0-9._]+)\/$/);
      if (m) rawAuthor = m[1];
    });

    // Caption: longest text span outside the header
    let caption = "";
    el.querySelectorAll('span[dir="auto"]').forEach((s) => {
      if (header?.contains(s)) return;
      const t = s.innerText?.trim() ?? "";
      if (t.length > caption.length) caption = t;
    });

    // Sponsored label
    const isSponsored = Array.from(el.querySelectorAll("span")).some((s) =>
      SPONSORED_WORDS.includes((s.textContent ?? "").trim().toLowerCase())
    );

    // Media type
    let mediaType = "unknown";
    if (isReel) mediaType = "reel";
    else if (el.querySelector("video")) mediaType = "video";
    else if (el.querySelectorAll("ul li img").length > 1) mediaType = "carousel";
    else if (el.querySelector("img")) mediaType = "image";

    // Post time
    const postedAt = el.querySelector("time")?.getAttribute("datetime") ?? "";

    if (!rawAuthor && !caption && !shortcode) return null;

    return {
      platform: "instagram",
      postId: shortcode,
      rawAuthor,
      caption: caption.slice(0, 1000),
      mediaType,
      url: shortcode ? `https://www.instagram.com/${isReel ? "reel" : "p"}/${shortcode}/` : "",
      postedAt,
      isSponsored,
      position,
      sessionId,
      seenAt: Date.now(),
    };
  },
};