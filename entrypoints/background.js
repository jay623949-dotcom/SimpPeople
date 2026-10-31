export default defineBackground(() => {
  // Open the consent page after install
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === "install") {
      chrome.tabs.create({ url: chrome.runtime.getURL("/consent.html") });
    }
  });

  // Handle messages one at a time so saves never overwrite each other
  let chain = Promise.resolve();

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "POST_SEEN") {
      chain = chain.then(() => savePost(msg.post)).catch(console.error);
    }
  });
});

async function savePost(post) {
  const { consented, paused, participantId, queue = [] } = await chrome.storage.local.get([
    "consented",
    "paused",
    "participantId",
    "queue",
  ]);
  if (!consented || paused) return;

  queue.push({ ...post, participantId });
  await chrome.storage.local.set({ queue });
}