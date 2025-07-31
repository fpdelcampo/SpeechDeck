let prefs = {
    enabled: true,
    voice: "",
    rate: 1.0,
    template: "{author} said: {tweet}",
    columns: {}
};

chrome.storage.sync.get(prefs, p => { prefs = { ...prefs, ...p }; reflectBadge(); });

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [k, v] of Object.entries(changes)) prefs[k] = v.newValue;
    if (changes.enabled) reflectBadge();
    if (changes.rate || changes.voice || changes.template) chrome.tts.stop();
});

chrome.runtime.onMessage.addListener((msg, sender) => {
    if (msg.type !== "new-tweet") return;
    if (!prefs.enabled) return;                                 
    if (prefs.columns[msg.info.column] === false) return;

    const t = msg.info;
    const text = prefs.template
        .replace("{time}",   t.timeLocal || t.datetime)
        .replace("{author}", t.author || "Someone")
        .replace("{column}", t.column || "a column")
        .replace("{tweet}",  t.tweet  || "");
    console.log('[XPro Speaker background.js] SPEAK', text);
    chrome.tts.speak(text, { rate: prefs.rate, voiceName: prefs.voice || undefined });
});

async function reflectBadge() {
    await chrome.action.setBadgeText({ text: prefs.enabled ? "" : "OFF" });
}
