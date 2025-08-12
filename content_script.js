const fmtTime = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function getColumnName(fromEl) {
    const columnBox = fromEl.closest('div[class="css-175oi2r r-cpa5s6"]');
    if (!columnBox) return 'Unknown';

    const columnTitle = columnBox.querySelector('div[data-testid="column-title-wrapper"] h1 span');
    return columnTitle?.textContent?.trim() || 'Unknown';
}

function extractTweet(article) {
    const bodyEl = article.querySelector('[data-testid="tweetText"]');
    if (!bodyEl) return null;

    const linkToStatus = article.querySelector('a[href*="/status/"]')?.href || '';
    const statusId = linkToStatus.match(/\/status\/(\d{5,})/)?.[1] || null;

    const nameSpan = article.querySelector('[data-testid="User-Name"] span');
    const author =
        linkToStatus ? (new URL(linkToStatus).pathname.split('/')[1] || '') :
        nameSpan?.textContent?.trim() || '';

    const timeEl = article.querySelector('time');
    const whenIso = timeEl?.dateTime || new Date().toISOString();

    return {
        statusId,
        url: linkToStatus,
        tweet: bodyEl.innerText.trim(),
        author,
        datetime: whenIso,
        timeLocal: fmtTime(new Date(whenIso))
    };
}

function waitForQuiet(ms = 500) {
    return new Promise(resolve => {
        let t;
        const mo = new MutationObserver(() => {
            clearTimeout(t);
            t = setTimeout(done, ms);
        });
        function done() { mo.disconnect(); resolve(); }
        mo.observe(document.body, { childList: true, subtree: true });
        t = setTimeout(done, ms);
    });
}

(async function startAfterInitialLoad() {
    await waitForQuiet(1000);           
    attachTweetObserver();             
})();

function attachTweetObserver() {
    new MutationObserver(muts => {
        for (const m of muts) {
            for (const node of m.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                const article = node.matches?.('[data-testid="tweet"], article')
                    ? node
                    : node.querySelector?.('[data-testid="tweet"], article');

                if (!article) continue;
                if (!article.querySelector('[data-testid="tweetText"]')) continue;

                const infoBase = extractTweet(article);
                if (!infoBase) continue;

                const column = normTitle(getColumnName(article));
                const info = { column, ...infoBase };

                chrome.runtime.sendMessage({ type: 'new-tweet', info });
            }
        }
    }).observe(document.body, { childList: true, subtree: true });
}

function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function normTitle(t) {
    return (t || 'Unknown').trim().replace(/\s+/g, ' ');
}

async function pushColumns() {
    const found = [...document.querySelectorAll('div[class="css-175oi2r r-cpa5s6"] div[data-testid="column-title-wrapper"] h1 span')]
    const columns = [...document.querySelectorAll('div[class="css-175oi2r r-cpa5s6"] div[data-testid="column-title-wrapper"] h1 span')]
        .map(span => span.textContent.trim())
        .filter(Boolean)
        .map(normTitle);

    if (!columns.length) return;
    const defaults = Object.fromEntries(columns.map(n => [n, true]));
    await chrome.storage.sync.get({ columns: {} }, async stored => {
        await chrome.storage.sync.set({
            columnsDetected: columns,
            columns: { ...defaults, ...stored.columns }
        });
    });
}

const pushColumnsDebounced = debounce(pushColumns, 300);
window.addEventListener('load', pushColumns);
new MutationObserver(() => pushColumnsDebounced())
    .observe(document.body, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type !== 'get-column-titles') return;
    const titles = [...document.querySelectorAll('div[data-testid="column-title-wrapper"] h1 span')]
        .map(s => s.textContent.trim())
    sendResponse([...new Set(titles)]);
    return true;
});