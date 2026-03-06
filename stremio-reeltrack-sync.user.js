// ==UserScript==
// @name         Stremio Library Exporter — Reeltrack Edition
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Export Stremio library with IMDb IDs, titles, types, and watch status — compatible with Reeltrack importer. Now with direct ReelTrack sync!
// @match        https://web.stremio.com/*
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// @connect      localhost
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ═══════════════════════════════════════════════
    // CONFIG — Change this if your ReelTrack runs elsewhere
    // ═══════════════════════════════════════════════
    const REELTRACK_API = 'http://127.0.0.1:5000/api/library/stremio-web-sync';

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    function normalizeTitle(t) { return (t || '').replace(/\s+/g, ' ').trim(); }

    function downloadZip(files, zipName = 'Stremio-Library.zip') {
        const zip = new JSZip();
        Object.entries(files).forEach(([name, content]) => zip.file(name, content));
        return zip.generateAsync({ type: 'blob' }).then(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = zipName;
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
        });
    }

    const ANCHOR_SELECTOR = 'a[href*="/#/detail/"], a[href*="/detail/"], .meta-item-QFHCh';
    const TITLE_SELECTORS = ['.title-label-VnEAc', '.title-label-mb1GR', '.title', 'h3', 'h4'];

    function extractTitleFromAnchor(a) {
        if (!a) return 'Unknown';
        const tAttr = (a.getAttribute && (a.getAttribute('title') || a.title)) || '';
        if (tAttr && tAttr.trim()) return normalizeTitle(tAttr);
        for (const sel of TITLE_SELECTORS) {
            try {
                const el = a.querySelector && a.querySelector(sel);
                if (el && el.textContent && el.textContent.trim()) return normalizeTitle(el.textContent);
            } catch (e) { }
        }
        try {
            const img = a.querySelector && a.querySelector('img');
            if (img) {
                const i = (img.alt || img.title || '').trim();
                if (i) return normalizeTitle(i);
            }
        } catch (e) { }
        const txt = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (txt) return normalizeTitle(txt);
        return 'Unknown';
    }

    function extractMetaFromHref(href) {
        if (!href) return { type: null, imdb_id: null };
        const m = String(href).match(/\/detail\/(movie|series|tv|show)\/(tt\d+)/i);
        if (m) {
            const rawType = m[1].toLowerCase();
            const type = rawType === 'movie' ? 'movie' : 'series';
            return { type, imdb_id: m[2] };
        }
        const typeOnly = String(href).match(/\/detail\/(movie|series|tv|show)\b/i);
        if (typeOnly) {
            const rawType = typeOnly[1].toLowerCase();
            return { type: rawType === 'movie' ? 'movie' : 'series', imdb_id: null };
        }
        return { type: null, imdb_id: null };
    }

    function ancestorBoardRowType(el) {
        let cur = el;
        while (cur) {
            try {
                const row = cur.closest && cur.closest('.board-row-CoJrZ, .board-row-poster-QPQqC');
                if (!row) break;
                const header = row.querySelector && row.querySelector('.title-container-RuV2b');
                const headerText = (header && (header.getAttribute('title') || header.textContent)) || '';
                if (/movie/i.test(headerText)) return 'movie';
                if (/series|tv|show/i.test(headerText)) return 'series';
            } catch (e) { }
            cur = cur.parentElement;
        }
        return null;
    }

    function isWatchedElement(root) {
        if (!root) return false;
        try {
            if (root.querySelector && root.querySelector('[class*="watched"], .watched-icon-layer-bi3DO, [class*="seen"], .watched-progress')) return true;
            const nodes = (root.querySelectorAll && root.querySelectorAll('[aria-label], [title]')) || [];
            for (const n of nodes) {
                const s = (n.getAttribute && (n.getAttribute('aria-label') || n.getAttribute('title')) || '').toLowerCase();
                if (s.includes('watched') || s.includes('seen')) return true;
            }
            if (root.querySelector && root.querySelector('[class*="percent"], [class*="progress-bar"], [class*="progress"]')) return true;
        } catch (e) { }
        return false;
    }

    function collectFromDOM() {
        const anchors = Array.from(document.querySelectorAll(ANCHOR_SELECTOR));
        const itemsById = new Map();

        for (const aElem of anchors) {
            let a = aElem;
            if (a && a.nodeType !== 1) continue;
            if (a && !a.href && a.querySelector) {
                const possible = a.querySelector('a[href*="/detail/"], a[href*="/#/detail/"]');
                if (possible) a = possible;
            }

            const href = (a.getAttribute && (a.getAttribute('href') || a.href)) || '';
            const title = extractTitleFromAnchor(a);
            const { type: typeFromHref, imdb_id } = extractMetaFromHref(href);
            const typeFromRow = ancestorBoardRowType(a);
            const watched = isWatchedElement(a);
            const type = typeFromHref || typeFromRow || 'unknown';

            const key = imdb_id || `title:${title}`;
            const prev = itemsById.get(key);
            if (!prev) {
                itemsById.set(key, { title, type, watched, imdb_id: imdb_id || null });
            } else {
                prev.watched = prev.watched || watched;
                if (prev.type === 'unknown' && type !== 'unknown') prev.type = type;
                if (!prev.imdb_id && imdb_id) prev.imdb_id = imdb_id;
                if (!prev.title || prev.title === 'Unknown') prev.title = title;
            }
        }
        return Array.from(itemsById.values());
    }

    function findScrollContainer() {
        const sample = document.querySelector('.meta-item-QFHCh, .poster-container-qkw48, a[href*="/#/detail/"]');
        if (sample) {
            let el = sample;
            for (let i = 0; i < 12 && el; i++) {
                el = el.parentElement;
                if (!el) break;
                const hasScrollable = el.scrollHeight > el.clientHeight + 10;
                const overflowY = window.getComputedStyle(el).overflowY;
                if (hasScrollable && /auto|scroll|overlay/.test(overflowY)) return el;
            }
        }
        return document.scrollingElement || document.documentElement || document.body;
    }

    async function microScrollAndWait({ microSteps = 8, baseMs = 180, maxLoops = 160, stableChecks = 4 } = {}) {
        const container = findScrollContainer();
        const isDocument = (container === document.scrollingElement || container === document.documentElement || container === document.body);
        let prevCount = document.querySelectorAll(ANCHOR_SELECTOR).length;
        let prevHeight = container.scrollHeight || document.body.scrollHeight;
        let stable = 0;
        const viewport = isDocument ? (window.innerHeight || document.documentElement.clientHeight) : container.clientHeight;
        const outerStep = Math.max(150, Math.floor(viewport * 0.5));

        for (let loop = 0; loop < maxLoops; loop++) {
            for (let i = 0; i < microSteps; i++) {
                const delta = Math.ceil(outerStep / microSteps);
                if (isDocument) window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
                else container.scrollTop = Math.min(container.scrollTop + delta, container.scrollHeight);
                await sleep(baseMs);
            }
            await sleep(baseMs + 200);
            const newCount = document.querySelectorAll(ANCHOR_SELECTOR).length;
            const newHeight = container.scrollHeight || document.body.scrollHeight;
            if (newCount > prevCount || newHeight > prevHeight) stable = 0;
            else stable++;
            prevCount = newCount; prevHeight = newHeight;
            const scrollPos = isDocument ? (window.scrollY || window.pageYOffset) : container.scrollTop;
            const maxScroll = (isDocument ? (document.body.scrollHeight || document.documentElement.scrollHeight) : container.scrollHeight)
                - (isDocument ? (window.innerHeight || document.documentElement.clientHeight) : container.clientHeight);
            if ((maxScroll - scrollPos) <= 12 && stable >= stableChecks) break;
        }

        try {
            if (isDocument) {
                for (let s = 0; s < 4; s++) {
                    window.scrollBy({ top: -120, behavior: 'auto' }); await sleep(80);
                    window.scrollBy({ top: 120, behavior: 'auto' }); await sleep(120);
                }
                window.scrollTo(0, document.body.scrollHeight || document.documentElement.scrollHeight);
            } else {
                for (let s = 0; s < 4; s++) {
                    container.scrollTop = Math.max(0, container.scrollTop - 120); await sleep(80);
                    container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + 120); await sleep(120);
                }
                container.scrollTop = container.scrollHeight;
            }
        } catch (e) { }
        await sleep(450);
    }

    // ═══════════════════════════════════════════════
    // COLLECT & BUILD PAYLOAD
    // ═══════════════════════════════════════════════
    async function collectFullLibrary({ attemptsAfterScroll = 3 } = {}) {
        await microScrollAndWait({ microSteps: 8, baseMs: 200, maxLoops: 200, stableChecks: 4 });

        let finalItems = [];
        for (let i = 0; i < attemptsAfterScroll; i++) {
            finalItems = collectFromDOM();
            await sleep(200 + i * 120);
        }
        return finalItems;
    }

    // ═══════════════════════════════════════════════
    // EXPORT TO ZIP (original behavior)
    // ═══════════════════════════════════════════════
    async function runExport({ attemptsAfterScroll = 3 } = {}) {
        const finalItems = await collectFullLibrary({ attemptsAfterScroll });

        const moviesWatched = [], moviesUnwatched = [];
        const tvWatched = [], tvUnwatched = [];

        finalItems.forEach(it => {
            if (it.type === 'movie') {
                (it.watched ? moviesWatched : moviesUnwatched).push(it);
            } else if (it.type === 'series') {
                (it.watched ? tvWatched : tvUnwatched).push(it);
            }
        });

        const sortItems = arr => arr.slice().sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));

        const reeltrackPayload = {
            exported_at: new Date().toISOString(),
            source: "stremio",
            version: "1.1",
            stats: {
                total: finalItems.length,
                movies: moviesWatched.length + moviesUnwatched.length,
                series: tvWatched.length + tvUnwatched.length,
                watched: moviesWatched.length + tvWatched.length,
                want_to_watch: moviesUnwatched.length + tvUnwatched.length
            },
            items: [
                ...sortItems(moviesWatched).map(it => ({ imdb_id: it.imdb_id, title: it.title, type: "movie", status: "watched" })),
                ...sortItems(moviesUnwatched).map(it => ({ imdb_id: it.imdb_id, title: it.title, type: "movie", status: "want_to_watch" })),
                ...sortItems(tvWatched).map(it => ({ imdb_id: it.imdb_id, title: it.title, type: "series", status: "watched" })),
                ...sortItems(tvUnwatched).map(it => ({ imdb_id: it.imdb_id, title: it.title, type: "series", status: "want_to_watch" }))
            ]
        };

        const toLines = arr => sortItems(arr).map(it => it.imdb_id ? `${it.title} [${it.imdb_id}]` : it.title).join('\n');

        const zipFiles = {
            'Reeltrack-Import.json': JSON.stringify(reeltrackPayload, null, 2),
            'Movies-Watched.txt': toLines(moviesWatched),
            'Movies-Unwatched.txt': toLines(moviesUnwatched),
            'TV-Watched.txt': toLines(tvWatched),
            'TV-Unwatched.txt': toLines(tvUnwatched)
        };

        await downloadZip(zipFiles, `Stremio-Reeltrack-${new Date().toISOString().slice(0, 10)}.zip`);
        showToast(`<b>Export complete!</b><br>
      🎬 Movies: ${moviesWatched.length + moviesUnwatched.length} (${moviesWatched.length} watched)<br>
      📺 Series: ${tvWatched.length + tvUnwatched.length} (${tvWatched.length} watched)`);
    }

    // ═══════════════════════════════════════════════
    // DIRECT SYNC TO REELTRACK (new!)
    // ═══════════════════════════════════════════════
    async function runDirectSync() {
        const finalItems = await collectFullLibrary({ attemptsAfterScroll: 4 });

        // Map to the format the ReelTrack API expects
        const payload = finalItems
            .filter(it => it.imdb_id)
            .map(it => ({
                imdbId: it.imdb_id,
                title: it.title,
                type: it.type || 'movie',
                isWatched: !!it.watched,
                year: 0
            }));

        if (payload.length === 0) {
            showToast('⚠️ No items with IMDb IDs found. Try scrolling through your library first.', '#ff6b6b');
            return;
        }

        // POST directly to ReelTrack backend using GM_xmlhttpRequest to bypass CORS/Mixed Content
        try {
            GM_xmlhttpRequest({
                method: "POST",
                url: REELTRACK_API,
                headers: { "Content-Type": "application/json" },
                data: JSON.stringify({ items: payload }),
                onload: function (response) {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            const result = JSON.parse(response.responseText);
                            if (result.success) {
                                showToast(`<b>⚡ ReelTrack Sync Complete!</b><br>
                  ✅ ${result.added} new items added<br>
                  ⏭️ ${result.skipped} already in library<br>
                  👁️ ${result.watchedUpdated} watched status updated`, '#00c853');
                            } else {
                                showToast('❌ Sync failed — check ReelTrack server logs', '#ff6b6b');
                            }
                        } catch (e) {
                            showToast('❌ Sync failed — unparseable response from ReelTrack', '#ff6b6b');
                        }
                    } else {
                        showToast(`❌ HTTP ${response.status}: ${response.statusText}`, '#ff6b6b');
                    }
                },
                onerror: function (err) {
                    console.error('[ReelTrack Sync]', err);
                    showToast(`❌ Could not reach ReelTrack.<br><br>Is the backend running on port 5000?`, '#ff6b6b');
                }
            });
        } catch (err) {
            console.error('[ReelTrack Sync]', err);
            showToast(`❌ Error initializing sync:<br>${err.message}`, '#ff6b6b');
        }
    }

    // ═══════════════════════════════════════════════
    // UI HELPERS
    // ═══════════════════════════════════════════════
    function showToast(html, borderColor = '#333') {
        const toast = document.createElement('div');
        toast.innerHTML = html;
        Object.assign(toast.style, {
            position: 'fixed', right: '12px', top: '56px', zIndex: 9999999,
            background: 'rgba(10,10,20,0.95)', color: '#fff', padding: '12px 16px',
            borderRadius: '8px', fontSize: '13px', lineHeight: '1.6',
            border: `1px solid ${borderColor}`, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            maxWidth: '320px'
        });
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 6000);
    }

    function createButtons() {
        if (document.getElementById('reeltrack-export-btn')) return;

        // Container for both buttons
        const container = document.createElement('div');
        container.id = 'reeltrack-export-btn';
        Object.assign(container.style, {
            position: 'fixed', top: '12px', right: '12px', zIndex: 9999999,
            display: 'flex', gap: '8px', flexDirection: 'column'
        });

        // ⚡ Sync to ReelTrack button (primary)
        const syncBtn = document.createElement('button');
        syncBtn.textContent = '⚡ Sync to ReelTrack';
        Object.assign(syncBtn.style, {
            padding: '8px 14px', background: '#7B5BF5', color: '#fff',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(123,91,245,0.4)', fontSize: '13px', fontWeight: '700',
            transition: 'all 0.2s'
        });
        syncBtn.onmouseenter = () => { syncBtn.style.background = '#6a4de0'; syncBtn.style.transform = 'scale(1.02)'; };
        syncBtn.onmouseleave = () => { syncBtn.style.background = '#7B5BF5'; syncBtn.style.transform = 'scale(1)'; };

        syncBtn.addEventListener('click', async () => {
            syncBtn.disabled = true; syncBtn.style.opacity = '0.6';
            syncBtn.textContent = '⏳ Scrolling & syncing...';
            const prog = document.createElement('div');
            prog.textContent = 'Loading all library items — please wait...';
            Object.assign(prog.style, {
                position: 'fixed', right: '12px', top: '100px', zIndex: 9999999,
                background: 'rgba(10,10,20,0.9)', color: '#fff', padding: '8px 14px',
                borderRadius: '6px', fontSize: '13px'
            });
            document.body.appendChild(prog);
            try {
                await runDirectSync();
            } catch (err) {
                console.error('[ReelTrack Sync]', err);
                showToast(`❌ Sync error: ${err.message}`, '#ff6b6b');
            } finally {
                prog.remove();
                syncBtn.disabled = false; syncBtn.style.opacity = '1';
                syncBtn.textContent = '⚡ Sync to ReelTrack';
            }
        });

        // 🎬 Export ZIP button (secondary)
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '🎬 Export ZIP';
        Object.assign(exportBtn.style, {
            padding: '6px 12px', background: '#f5c518', color: '#000',
            border: 'none', borderRadius: '8px', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)', fontSize: '12px', fontWeight: '600',
            transition: 'all 0.2s'
        });

        exportBtn.addEventListener('click', async () => {
            exportBtn.disabled = true; exportBtn.style.opacity = '0.6';
            exportBtn.textContent = '⏳ Exporting...';
            const prog = document.createElement('div');
            prog.textContent = 'Loading all library items — please wait...';
            Object.assign(prog.style, {
                position: 'fixed', right: '12px', top: '100px', zIndex: 9999999,
                background: 'rgba(10,10,20,0.9)', color: '#fff', padding: '8px 14px',
                borderRadius: '6px', fontSize: '13px'
            });
            document.body.appendChild(prog);
            try {
                await runExport({ attemptsAfterScroll: 4 });
            } catch (err) {
                console.error('[Reeltrack Exporter]', err);
                alert('Export error — check the browser console for details.');
            } finally {
                prog.remove();
                exportBtn.disabled = false; exportBtn.style.opacity = '1';
                exportBtn.textContent = '🎬 Export ZIP';
            }
        });

        container.appendChild(syncBtn);
        container.appendChild(exportBtn);
        document.body.appendChild(container);
    }

    createButtons();
    window.addEventListener('hashchange', () => { if (location.hash.includes('/library')) createButtons(); });
    const mo = new MutationObserver(() => { if (document.querySelector(ANCHOR_SELECTOR)) createButtons(); });
    mo.observe(document.body, { childList: true, subtree: true });

})();
