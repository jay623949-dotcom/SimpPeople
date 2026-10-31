const $ = (id) => document.getElementById(id);

async function render() {
  const s = await chrome.storage.local.get(["consented", "paused", "queue"]);

  $("noConsent").hidden = !!s.consented;
  $("main").hidden = !s.consented;
  if (!s.consented) return;

  $("status").textContent = s.paused ? "Paused" : "Collecting";
  $("count").textContent = (s.queue ?? []).length;
  $("pause").textContent = s.paused ? "Resume" : "Pause";
}

$("review").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("/consent.html") });
});

$("pause").addEventListener("click", async () => {
  const { paused } = await chrome.storage.local.get("paused");
  await chrome.storage.local.set({ paused: !paused });
});

$("export").addEventListener("click", async () => {
  const { queue = [] } = await chrome.storage.local.get("queue");
  const blob = new Blob([JSON.stringify(queue, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "my-feed-data.json";
  a.click();
});

$("delete").addEventListener("click", async () => {
  if (confirm("Delete all collected data?")) await chrome.storage.local.set({ queue: [] });
});

$("withdraw").addEventListener("click", async () => {
  if (confirm("Withdraw from the study and delete everything?")) {
    await chrome.storage.local.clear();
  }
});

chrome.storage.onChanged.addListener(render); // live update while popup is open
render();