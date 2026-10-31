document.getElementById("agree").addEventListener("click", async () => {
  await chrome.storage.local.set({
    consented: true,
    paused: false,
    participantId: crypto.randomUUID(),
    consentedAt: Date.now(),
  });
  document.getElementById("form").hidden = true;
  document.getElementById("thanks").hidden = false;
});

document.getElementById("decline").addEventListener("click", () => window.close());