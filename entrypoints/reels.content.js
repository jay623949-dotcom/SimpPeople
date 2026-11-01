// entrypoints/reels.content.js
// The conductor for Reels. It does not read the page itself. It calls the other files:
//   utils/reels.js              reads the page (creator, caption, hashtags, audio)
//   utils/watchTracker.js       measures watching
//   utils/interactionTracker.js notices like / save / follow / clicks
//
// Life of one reel:
//   becomes active -> startView()  read the page, start the trackers
//   user watches   -> trackers count quietly, nothing is sent
//   user scrolls   -> endView()    read again, stop trackers, send ONE record
//
// Read-only: this never clicks, scrolls or fetches anything.

import {
  getActiveVideo,
  getReelContainer,
  getReelId,
  captionIsCut,
  readReelFrom,
} from "../utils/reels.js";
import { createWatchTracker } from "../utils/watchTracker.js";
import { createInteractionTracker } from "../utils/interactionTracker.js";

const TICK_MS = 500;          // how often we ask "is it still the same reel?"
const MIN_VISIBLE_MS = 300;   // reels that flash past faster than this are ignored

const longer = (a, b) => ((b?.length ?? 0) > (a?.length ?? 0) ? b : a);

export default defineContentScript({
  matches: ["*://*.instagram.com/*"],

  async main() {
    const sessionId = crypto.randomUUID(); // one id per page load, groups reels from one sitting
    let position = 0;                      // 1st reel sent, 2nd reel sent, ...
    let current = null;                    // the reel being watched right now (or null)
    let allowed = false;                   // true only if the user consented and is not paused

    // ---- consent: read it now, and again whenever it changes ----
    async function refreshAllowed() {
      const { consented, paused } = await chrome.storage.local.get(["consented", "paused"]);
      allowed = !!consented && !paused;
    }
    await refreshAllowed();
    chrome.storage.onChanged.addListener(refreshAllowed);

    // Reel pages look like /reels/ID/ or /reel/ID/. The audio pages (/reels/audio/...) are not feeds.
    function isReelsPage() {
      const p = location.pathname;
      return /^\/reels?\//.test(p) && !p.startsWith("/reels/audio");
    }

    // ---- a new reel became active ----
    function startView(video, reelId) {
      const box = getReelContainer(video);
      if (!box) return;

      current = {
        video,
        box,
        startedAt: Date.now(),
        first: readReelFrom(video, box, reelId), // snapshot 1 (arrival)
        firstCut: captionIsCut(box),
        watch: createWatchTracker(video),
        interact: createInteractionTracker(box),
      };
    }

    // ---- the user scrolled away: build ONE record and send it ----
    function endView() {
      const view = current;
      current = null;
      if (!view) return;

      const watch = view.watch.stop();

      // Snapshot 2 (leave). Instagram may reuse the same page elements for a different reel,
      // so we only trust it if the creator is still the same. If not, fall back to snapshot 1.
      const last = readReelFrom(view.video, view.box, view.first.reelId);
      const trust = !view.first.creator || last.creator === view.first.creator;
      const interaction = view.interact.stop(trust);
      const end = trust ? last : view.first;

      if (Date.now() - view.startedAt < MIN_VISIBLE_MS) return; // flicked past, not a real view
      if (!allowed) return;                                     // consent withdrawn or paused

      const reelId = view.first.reelId;
      const record = {
        ...view.first,
        postId: reelId,       // same field names as the home-feed posts, so the data lines up
        mediaType: "reel",
        url: reelId ? `https://www.instagram.com/reel/${reelId}/` : "",
        creator: view.first.creator || end.creator,
        caption: longer(view.first.caption, end.caption), // the user may have pressed "more"
        hashtags: [...new Set([...view.first.hashtags, ...end.hashtags])],
        audioId: view.first.audioId || end.audioId,
        audioName: view.first.audioName || end.audioName,
        captionMayBeCut: trust ? captionIsCut(view.box) : view.firstCut,
        ...watch,        // secondsWatched, duration, watchPercent, loops, secondsOnScreen
        ...interaction,  // liked, likedThisView, saved, followStatus, openedComments, ...
        quickSkip: watch.secondsOnScreen < 2,
        leaveSnapshotReliable: trust,
        position: ++position,
        sessionId,
        seenAt: view.startedAt,
      };

      try {
        chrome.runtime.sendMessage({ type: "POST_SEEN", post: record }).catch(() => {});
        console.log("[Feed Digest] reel saved:", record);
      } catch (err) {
        // Happens if the extension was reloaded while this page stayed open.
        console.warn("[Feed Digest] could not send; reload the Instagram tab.", err);
      }
    }

    // ---- runs twice a second: has the active reel changed? ----
    function tick() {
      try {
        if (!allowed || !isReelsPage()) {
          if (current) endView(); // left the reels page, or paused: close the open reel
          return;
        }

        const video = getActiveVideo();
        if (!video || (current && video === current.video)) return; // nothing new

        // The address bar updates a moment AFTER the new video reaches the middle of the
        // screen. If the ID has not changed yet, wait for the next tick, or we would save
        // the new reel under the old reel's ID.
        const reelId = getReelId();
        if (current && reelId === current.first.reelId) return;

        if (current) endView();
        startView(video, reelId);
      } catch (err) {
        console.error("[Feed Digest]", err); // log it, but keep the timer alive
      }
    }

    setInterval(tick, TICK_MS);
    window.addEventListener("pagehide", () => {
      if (current) endView(); // the tab is closing: do not lose the reel being watched
    });
  },
});
