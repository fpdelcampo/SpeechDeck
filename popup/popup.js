const DEFAULTS = {
	enabled: true,
	voice: "",
	rate: 1.0,
	template: "{author} said: {tweet}",
	columns: {},              // {"Home": true, "Elon List": false}
	columnsDetected: []       // filled by the content script
};

document.addEventListener("DOMContentLoaded", init);
let currentPrefs = { ...DEFAULTS };

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return; // only react to sync storage
  // reflect master toggle instantly
  if (changes.enabled) byId('enabled').checked = !!changes.enabled.newValue;

  // if column titles or toggles changed, rebuild the panel
  if (changes.columns || changes.columnsDetected) {
    chrome.storage.sync.get(DEFAULTS, (prefs) => {
      currentPrefs = { ...currentPrefs, ...prefs };
      const detectedMap = Object.fromEntries((prefs.columnsDetected || []).map(n => [n, true]));
      const merged = { ...detectedMap, ...prefs.columns };
      renderColumns(merged);
    });
  }
});

function byId(id) { return document.getElementById(id); }

function init() {
	chrome.storage.sync.get(DEFAULTS, (prefs) => {
		byId("enabled").checked = !!prefs.enabled;
		// …populate other controls…
	});

	byId("enabled").addEventListener("change", () => {
		chrome.storage.sync.set({ enabled: byId("enabled").checked });
	});

    chrome.tts.getVoices((voices) => {
		const voiceSelect = byId("voice");
		voiceSelect.innerHTML = "";
		for (const v of voices) {
			const opt = document.createElement("option");
			opt.value = v.voiceName;
			opt.textContent = `${v.voiceName} (${v.lang})`;
			voiceSelect.appendChild(opt);
		}

		chrome.storage.sync.get(DEFAULTS, (prefs) => {
			voiceSelect.value = prefs.voice || voices[0]?.voiceName || "";
			byId("rate").value = String(prefs.rate);
			byId("rateVal").textContent = prefs.rate + "×";
			byId("template").value = prefs.template;

			// Merge detected column names (default ON) with saved toggles.
			const detectedMap = Object.fromEntries((prefs.columnsDetected || []).map(n => [n, true]));
			const merged = { ...detectedMap, ...prefs.columns };
			renderColumns(merged);

			updatePreview();
		});
  	});

  	// UI events
	byId("rate").addEventListener("input", (e) => {
		byId("rateVal").textContent = e.target.value + "×";
	});
	byId("template").addEventListener("input", updatePreview);
	byId("save").addEventListener("click", save);
}

function renderColumns(map) {
  const wrap = byId("columns");
  wrap.innerHTML = "";
  const entries = Object.entries(map);
  if (!entries.length) {
    wrap.innerHTML = '<p class="hint">No columns yet. Open X Pro.</p>';
    return;
  }
  for (const [name, enabled] of entries) {
    const label = document.createElement("label");
    label.className = "col-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.col = name;
    cb.checked = !!enabled;

    cb.addEventListener("change", () => {
      // read current map, update a single key, write back
      chrome.storage.sync.get({ columns: {} }, cur => {
        const next = { ...cur.columns, [name]: cb.checked };
        chrome.storage.sync.set({ columns: next });
      });
    });

    const span = document.createElement("span");
    span.textContent = name;

    label.append(cb, span);
    wrap.appendChild(label);
  }
}


function updatePreview() {
  const tpl = byId("template").value || DEFAULTS.template;
  const sample = tpl
    .replace("{time}", "11:59")
    .replace("{author}", "ElonMusk")
    .replace("{column}", "Elon List")
    .replace("{tweet}", "X is cool");
  byId("preview").textContent = sample;
}

function save() {
	const columns = {};
	document.querySelectorAll('input[data-col]').forEach(cb => {
		columns[cb.dataset.col] = cb.checked;
	});

	const prefs = {
		voice: byId("voice").value,
		rate: Number(byId("rate").value),
		template: (byId("template").value || "").trim() || DEFAULTS.template,
		columns
	};

	chrome.storage.sync.set(prefs, () => {
		byId("status").textContent = "✔ Saved";
		setTimeout(() => byId("status").textContent = "", 1200);
	});
}
