// utils/watchTracker.js
// Measures how much of ONE reel the user actually watches.
// Read-only: it only listens to the video, it never plays, pauses or seeks it.
//
// How to use:
//   const tracker = createWatchTracker(video);   // when a reel becomes active
//   ...user watches...
//   const stats = tracker.stop();                // when the user scrolls away

function createWatchTracker(video) {
  let watched = 0;                   // seconds of video actually played
  let loops = 0;                     // how many times it restarted from the beginning
  let lastTime = video.currentTime;  // where the video was at the previous update
  const startedAt = Date.now();      // when we started tracking (milliseconds)

  // The browser calls this function about 4 times per second while the video plays.
  function onTimeUpdate() {
    const now = video.currentTime;
    const delta = now - lastTime; // how far the video moved since the last update

    if (delta > 0 && delta < 1.5) {
      // Small step forward = normal playback.
      watched += delta;
    } else if (delta < 0 && lastTime > video.duration - 1.5 && now < 1.5) {
      // Jumped from the very end back to the very start = the reel looped.
      loops++;
      watched += video.duration - lastTime + now; // count the bits on each side of the jump
    }
    // Anything else (a big jump) means the user dragged the progress bar. We ignore it,
    // because skipping ahead is not the same as watching.

    lastTime = now;
  }

  video.addEventListener("timeupdate", onTimeUpdate);

  // Read the numbers so far, without stopping.
  function read() {
    const duration = video.duration || 0; // duration can be NaN before the video loads
    return {
      secondsWatched: Math.round(watched * 10) / 10,
      duration: Math.round(duration * 10) / 10,
      watchPercent: duration ? Math.round((watched / duration) * 100) / 100 : 0, // 1.5 = watched 1.5 times
      loops,
      secondsOnScreen: Math.round((Date.now() - startedAt) / 100) / 10,
    };
  }

  return {
    read,
    stop() {
      video.removeEventListener("timeupdate", onTimeUpdate); // important: clean up after ourselves
      return read();
    },
  };
}

// KEEP THIS LINE LAST. When testing in the console, paste everything EXCEPT this line.
export { createWatchTracker };
