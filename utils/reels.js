// utils/reels.js
// Reads ONE reel on instagram.com/reels/...
// Read-only: it only looks at the page. It never clicks, scrolls or fetches anything.
// Every function here is small on purpose, so when Instagram changes its page
// we only have to fix the one function that broke.

// 1. Which video is on screen right now?
//    Instagram keeps ~15 videos loaded at once, so we pick the one crossing the
//    middle of the window.
function getActiveVideo() {
  const mid = window.innerHeight / 2;
  return (
    [...document.querySelectorAll("video")].find((v) => {
      const r = v.getBoundingClientRect();
      return r.top < mid && r.bottom > mid;
    }) ?? null
  );
}

// 2. The box that holds this reel's video AND its buttons and text.
//    Start at the video and climb up until the box contains a Like button.
function getReelContainer(video) {
  let box = video;
  while (box && !box.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"]')) {
    box = box.parentElement;
  }
  return box;
}

// 3. Reel ID: it is in the address bar, e.g. /reels/Dd8SU_DArOK/
function getReelId() {
  const id = location.pathname.match(/^\/reels?\/([\w-]+)/)?.[1] ?? "";
  return id === "audio" ? "" : id;
}

// 4. Creator: the link looks like /mixslides/reels/
function getCreator(box) {
  for (const a of box.querySelectorAll('a[href$="/reels/"]')) {
    const m = a.getAttribute("href").match(/^\/([A-Za-z0-9._]+)\/reels\/$/);
    if (m) return m[1];
  }
  return "";
}

// 5. Audio: the link looks like /reels/audio/1299733557311505/
//    There can be several links to the same audio (one is just the thumbnail),
//    so we use the first one that has text in it.
function getAudio(box) {
  const links = [...box.querySelectorAll('a[href^="/reels/audio/"]')];
  if (links.length === 0) return { id: "", name: "" };

  const id = links[0].getAttribute("href").match(/audio\/(\d+)/)?.[1] ?? "";
  const withText = links.find((a) => a.innerText.trim());
  const name = withText ? withText.innerText.trim().split("\n")[0].trim() : "";
  return { id, name };
}

// 6. Hashtags: each one is a link like /explore/tags/powerpoint/
function getHashtags(box) {
  const tags = [...box.querySelectorAll('a[href^="/explore/tags/"]')].map((a) =>
    decodeURIComponent(a.getAttribute("href").split("/")[3])
  );
  return [...new Set(tags)]; // remove duplicates
}

// 7. Caption: the longest piece of text in the box, after ignoring the creator
//    name, audio name, the Follow button and numbers like "1.8M" or "5,208".
function getCaption(box, creator, audioName) {
  const ignore = new Set([creator, audioName, "Follow", "Following"]);
  let best = "";
  box.querySelectorAll("span").forEach((s) => {
    const t = s.innerText?.trim() ?? "";
    if (ignore.has(t)) return;
    if (/^[\d.,]+\s?[KM]?$/i.test(t)) return;
    if (t.length > best.length) best = t;
  });
  return best.replace(/…\s*more$/i, "").trim();
}

// 9. Is the sound muted?
function isMuted(box) {
  return !!box.querySelector('svg[aria-label="Audio is muted"]');
}

// 10. Is the caption still cut off? While it is, Instagram shows a "... more" button.
function captionIsCut(box) {
  return [...box.querySelectorAll("span")].some((s) =>
    /^…?\s*more$/i.test(s.innerText?.trim() ?? "")
  );
}

// Read a reel from a box we ALREADY found. We need this to read the same reel a second
// time when the user scrolls away, because by then the active video is the next reel.
// (liked / saved / follow are NOT here: interactionTracker.js owns those.)
function readReelFrom(video, box, reelId) {
  const creator = getCreator(box);
  const audio = getAudio(box);

  return {
    platform: "instagram",
    surface: "reels",
    reelId,
    creator,
    caption: getCaption(box, creator, audio.name),
    hashtags: getHashtags(box),
    audioId: audio.id,
    audioName: audio.name,
    muted: isMuted(box),
    duration: video.duration,
  };
}

// Handy for testing in the console: read whichever reel is on screen right now.
function readReel() {
  const video = getActiveVideo();
  if (!video) return null;
  const box = getReelContainer(video);
  if (!box) return null;
  return readReelFrom(video, box, getReelId());
}

// KEEP THIS LINE LAST. When testing in the console, paste everything EXCEPT this line.
export { getActiveVideo, getReelContainer, getReelId, captionIsCut, readReelFrom, readReel };
