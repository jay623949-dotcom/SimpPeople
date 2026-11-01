// utils/interactionTracker.js
// Notices what the user does on ONE reel: like, save, follow, open comments,
// open share, repost.
// Read-only: it only listens. It never clicks anything for the user.
//
// How to use:
//   const tracker = createInteractionTracker(box);  // when a reel becomes active
//   ...user watches...
//   const result = tracker.stop();                  // when the user scrolls away
//
// "box" is the reel container from getReelContainer() in reels.js.

// Read the state of the buttons that change their label when you press them.
//   Like  -> Unlike     (confirmed on Instagram)
//   Save  -> Remove     (confirmed on Instagram)
function readButtonStates(box) {
  return {
    liked: !!box.querySelector('svg[aria-label="Unlike"]'),
    saved: !!box.querySelector('svg[aria-label="Remove"]'),
  };
}

// The Follow button has no icon label, so we look for the WORD on the button.
// (This only works while Instagram is set to English.)
// Three answers, because "no Follow button found" does not prove the user follows them:
//   "not_following" -> a "Follow" button is showing
//   "following"     -> a "Following" button is showing
//   "unknown"       -> neither was found
function readFollowStatus(box) {
  const texts = [...box.querySelectorAll("span, button, [role='button']")].map((el) =>
    el.innerText?.trim()
  );
  if (texts.includes("Following")) return "following";
  if (texts.includes("Follow")) return "not_following";
  return "unknown";
}

// These buttons do NOT show a state, so we can only notice the click.
// Opening the comments is not the same as writing a comment, so we name it honestly.
const CLICK_LABELS = {
  Comment: "openedComments",
  Share: "openedShare",
  Repost: "clickedRepost",
};

function createInteractionTracker(box) {
  const before = readButtonStates(box);        // snapshot on arrival
  const followBefore = readFollowStatus(box);  // snapshot on arrival
  const clicks = { openedComments: false, openedShare: false, clickedRepost: false };
  let clickedFollow = false;

  // ONE listener on the whole box, instead of one per button.
  // A click "bubbles": it starts at the thing you clicked (maybe a tiny <path> inside
  // an icon) and travels up through its parents, so the box hears every click inside it.
  function onClick(event) {
    // Icon buttons: find the icon that was clicked, or the icon inside the clicked button.
    const icon =
      event.target.closest("svg[aria-label]") ??
      event.target.closest('[role="button"], button')?.querySelector("svg[aria-label]");

    const field = CLICK_LABELS[icon?.getAttribute("aria-label")];
    if (field) clicks[field] = true;

    // The Follow button has no icon, so check the text of whatever was clicked.
    const text = event.target.closest("span, button, [role='button']")?.innerText?.trim();
    if (text === "Follow") clickedFollow = true;
  }

  // The "true" means: listen on the way DOWN to the button, so we still hear the click
  // even if Instagram's own code stops it from travelling up.
  box.addEventListener("click", onClick, true);

  return {
    // trustFinalState = false means "the page may have swapped this box to another reel,
    // so do not read the buttons again; just use the arrival snapshot".
    stop(trustFinalState = true) {
      box.removeEventListener("click", onClick, true); // clean up after ourselves
      const after = trustFinalState ? readButtonStates(box) : before; // snapshot on leave
      const followAfter = trustFinalState ? readFollowStatus(box) : followBefore;

      return {
        liked: after.liked,
        likedThisView: !before.liked && after.liked, // false if it was already liked on arrival
        saved: after.saved,
        savedThisView: !before.saved && after.saved,
        followStatus: followBefore, // was the creator followed when the reel appeared?
        // The button may turn into "Following" or may just disappear, so we accept either
        // the new state or the click itself.
        followedThisView:
          followBefore === "not_following" && (followAfter === "following" || clickedFollow),
        ...clicks,
      };
    },
  };
}

// KEEP THIS LINE LAST. When testing in the console, paste everything EXCEPT this line.
export { createInteractionTracker };
