// Content script for LeetCode contest ranking pages
/// <reference types="chrome"/>
import type {
    SearchRequest,
    SearchResponse,
    FoundUser,
    SearchState,
} from "../types";

(() => {
    // Add a global stop flag
    (window as any).__stopLeetCodeSearch = false;

    // =============================================================================
    // SQUAD MANAGEMENT - Add found users to friends
    // =============================================================================

    function addToSquad(username: string, buttonElement: HTMLButtonElement) {
        chrome.storage.local.get(
            { friends: [] },
            (result: { friends: string[] }) => {
                const friends = result.friends;

                if (friends.includes(username)) {
                    buttonElement.textContent = "✓ In Squad";
                    buttonElement.style.background = "#6c757d";
                    buttonElement.disabled = true;

                    setTimeout(() => {
                        buttonElement.textContent = "✓ Already Added";
                    }, 1000);
                    return;
                }

                friends.push(username);
                chrome.storage.local.set({ friends }, () => {
                    buttonElement.textContent = "✓ Added!";
                    buttonElement.style.background = "#25a351";
                    buttonElement.disabled = true;

                    console.log(`Added ${username} to squad`);
                });
            }
        );
    }

    // Fuzzy matching function to calculate similarity percentage
    function calculateSimilarity(str1: string, str2: string): number {
        const s1 = str1.replace(/\s+/g, "").toLowerCase();
        const s2 = str2.replace(/\s+/g, "").toLowerCase();

        if (s1 === s2) return 100;

        const matrix: number[][] = [];
        const len1 = s1.length;
        const len2 = s2.length;

        if (len1 === 0) return len2 === 0 ? 100 : 0;
        if (len2 === 0) return 0;

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        const distance = matrix[len1][len2];
        const maxLength = Math.max(len1, len2);
        return Math.round(((maxLength - distance) / maxLength) * 100);
    }

    // Store pending fuzzy matches for batch confirmation
    interface PendingMatch {
        searchName: string;
        topMatch: { name: string; similarity: number };
        availableNames: string[];
    }

    async function findFuzzyMatches(
        searchName: string,
        availableNames: string[],
        pendingMatches: PendingMatch[]
    ): Promise<string | null> {
        const matches: { name: string; similarity: number }[] = [];

        for (const availableName of availableNames) {
            const similarity = calculateSimilarity(searchName, availableName);
            if (similarity >= 70) {
                matches.push({ name: availableName, similarity });
            }
        }

        matches.sort((a, b) => b.similarity - a.similarity);

        if (matches.length > 0) {
            const topMatch = matches[0];

            // If exact match, accept immediately
            if (topMatch.similarity === 100) {
                return topMatch.name;
            }

            // Store for later batch confirmation
            pendingMatches.push({
                searchName,
                topMatch,
                availableNames,
            });

            // Return the match tentatively
            return topMatch.name;
        }

        return null;
    }

    async function findUsersInLeetCodeContest(
        opts: Partial<SearchRequest> = {}
    ) {
        if (
            !window.location.href.includes("/contest/") ||
            !window.location.href.includes("/ranking/")
        ) {
            alert(
                "❌ Please open a LeetCode contest ranking page first!\nExample: https://leetcode.com/contest/weekly-contest-465/ranking/1/"
            );
            return;
        }

        let userNamesToSearch: string[] = [];
        let foundUsers: Record<string, FoundUser> = {};
        let page = 1;
        let running = false;
        let pageSize = opts.pageSize || 25;
        let startRank = parseInt(String(opts.startRank), 10) || 1;
        let endRank = opts.endRank
            ? parseInt(String(opts.endRank), 10)
            : undefined;
        let startPage = opts.startPage || 1;
        let endPage = opts.endPage || Infinity;

        const savedState = sessionStorage.getItem("leetcodeSearchState");
        if (savedState) {
            const state: SearchState = JSON.parse(savedState);
            if (state.resumeSearch) {
                // Get current page from URL to verify we're on the right page
                const getCurrentPageFromUrl = () => {
                    const match =
                        window.location.href.match(/\/ranking\/(\d+)/);
                    return match ? parseInt(match[1], 10) : 1;
                };
                const currentUrlPage = getCurrentPageFromUrl();
                const expectedPage = state.targetPage || state.startPage;

                // Only resume if we're on the expected page
                if (currentUrlPage === expectedPage) {
                    sessionStorage.removeItem("leetcodeSearchState");

                    userNamesToSearch = state.usernames || [];
                    foundUsers = state.foundUsers || {};

                    for (const [key, value] of Object.entries(foundUsers)) {
                        if (typeof value === "number") {
                            foundUsers[key] = {
                                page: value as number,
                                actualName: key,
                                profileUrl: "",
                            };
                        } else if (value && !value.profileUrl) {
                            value.profileUrl = "";
                        }
                    }
                    startRank = state.startRank;
                    endRank = state.endRank;
                    startPage = expectedPage; // Use the current page we're on
                    endPage = state.endPage;
                    pageSize = state.pageSize || 25;

                    console.log(
                        `🔄 Resuming search from page ${currentUrlPage}`
                    );

                    createDialogAndStartSearch();
                    return;
                } else {
                    // Wrong page, clear state and don't resume
                    console.log(
                        `⚠️ Expected page ${expectedPage} but on page ${currentUrlPage}, clearing state`
                    );
                    sessionStorage.removeItem("leetcodeSearchState");
                }
            } else {
                sessionStorage.removeItem("leetcodeSearchState");
            }
        }

        const usernamesFromPopup = opts.usernames || "";
        userNamesToSearch = usernamesFromPopup
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);

        if (!userNamesToSearch.length) {
            alert("No valid usernames provided.");
            return;
        }

        createDialogAndStartSearch();

        function createDialogAndStartSearch() {
            const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

            const existingDialog = document.getElementById(
                "leetcode-search-dialog"
            );
            if (existingDialog) existingDialog.remove();

            const dialog = document.createElement("div");
            dialog.id = "leetcode-search-dialog";
            dialog.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 16px;
        background-color: #fff;
        border: 1px solid #d0d7de;
        border-radius: 10px;
        z-index: 99999;
        width: 300px;
        font-family: system-ui, Segoe UI, Arial, sans-serif;
        font-size: 13px;
        box-shadow: 0 4px 18px rgba(0,0,0,.15);
        color: #111;
        line-height: 1.35;
      `;

            dialog.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <strong style="font-size:15px;">Rank Search</strong>
          <button id="closeBtn" style="background:none;border:none;font-size:20px;line-height:1;cursor:pointer;color:#444;">×</button>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <input id="lc-start-rank" type="number" min="1" value="${startRank}" style="flex:1;background-color:#fff;padding:4px 6px;border:1px solid #ccc;border-radius:6px;" title="Start Rank" />
          <input id="lc-end-rank" type="number" min="1" value="${
              endRank || ""
          }" style="flex:1;background-color:#fff;padding:4px 6px;border:1px solid #ccc;border-radius:6px;" placeholder="End" title="End Rank (optional)" />
        </div>
        <div style="font-size:11px;margin:-4px 0 8px;color:#666;">Page size assumed ${pageSize}. Leave end blank for open ended.</div>
        <div id="loading-status" style="margin-bottom:10px;font-style:italic;color:#555;"></div>
        <div id="range-status" style="margin-bottom:8px;font-size:11px;color:#333;"></div>
        <div id="user-status-list" style="margin-bottom:12px;max-height:200px;overflow:auto;border:1px solid #eee;padding:6px;border-radius:6px;background:#fafafa;"></div>
        <div style="display:flex;gap:6px;">
          <button id="rerunBtn" style="flex:1;background:#1574e6;color:#fff;border:none;padding:8px 0;border-radius:6px;font-weight:600;cursor:pointer;">Rerun</button>
          <button id="stopBtn" style="flex:1;background:#e74c3c;color:#fff;border:none;padding:8px 0;border-radius:6px;font-weight:600;cursor:pointer;">Stop</button>
        </div>
      `;
            document.body.appendChild(dialog);

            const loadingStatus = document.getElementById("loading-status")!;
            const rangeStatus = document.getElementById("range-status")!;

            function updateRangeStatus() {
                const low = startRank;
                const high = endRank ? endRank : "…";
                rangeStatus.textContent = `Scanning ranks ${low} → ${high} (pages ${startPage} to ${
                    isFinite(endPage) ? endPage : "…"
                })`;
            }
            updateRangeStatus();

            document.getElementById("closeBtn")!.onclick = () => {
                (window as any).__stopLeetCodeSearch = true;
                dialog.remove();
            };
            document.getElementById("stopBtn")!.onclick = () => {
                (window as any).__stopLeetCodeSearch = true;
            };

            document.getElementById("rerunBtn")!.onclick = () => {
                if (running) {
                    alert("Search already running.");
                    return;
                }
                const sr =
                    parseInt(
                        (
                            document.getElementById(
                                "lc-start-rank"
                            ) as HTMLInputElement
                        ).value,
                        10
                    ) || 1;
                const erRaw = (
                    document.getElementById("lc-end-rank") as HTMLInputElement
                ).value.trim();
                const er = erRaw === "" ? undefined : parseInt(erRaw, 10);
                if (er && er < sr) {
                    alert("End rank must be >= start rank");
                    return;
                }
                startRank = sr;
                endRank = er;
                startPage = Math.floor((startRank - 1) / pageSize) + 1;
                endPage = endRank
                    ? Math.floor((endRank - 1) / pageSize) + 1
                    : Infinity;
                updateRangeStatus();

                foundUsers = {};
                const list = document.getElementById("user-status-list")!;
                list.innerHTML = userNamesToSearch
                    .map(
                        (u) =>
                            `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u}</span><span id="user-${u}" style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:2px 6px;min-width:70px;text-align:center;font-size:11px;flex-shrink:0;">…</span></div>`
                    )
                    .join("");

                searchAndClickNext();
            };

            async function waitForPageToLoad(
                pageNumber: number,
                timeout: number = 15000
            ): Promise<boolean> {
                loadingStatus.textContent = `Loading page ${pageNumber}…`;
                const checkInt = 300;
                const maxAttempts = Math.floor(timeout / checkInt);
                let lastCount = 0,
                    stable = 0;
                for (let i = 0; i < maxAttempts; i++) {
                    if ((window as any).__stopLeetCodeSearch) return false;
                    await delay(checkInt);
                    const nameDivs = document.querySelectorAll(
                        'a[href*="/u/"] .truncate'
                    );
                    const count = nameDivs.length;
                    const spinner = document.querySelector(
                        '.loading,.spinner,[data-loading="true"]'
                    );
                    if (count >= 5 && !spinner) {
                        if (count === lastCount) {
                            stable++;
                            if (stable >= 3) {
                                loadingStatus.textContent = `Page ${pageNumber} ready (${count})`;
                                return true;
                            }
                        } else {
                            stable = 0;
                            lastCount = count;
                        }
                    }
                    if (i % 5 === 0)
                        loadingStatus.textContent = `Loading page ${pageNumber}… (${count})`;
                }
                return true;
            }

            async function goToTargetPage(target: number) {
                const getCurrentPageFromUrl = () => {
                    const match =
                        window.location.href.match(/\/ranking\/(\d+)/);
                    return match ? parseInt(match[1], 10) : 1;
                };

                const currentPage = getCurrentPageFromUrl();

                if (currentPage === target) {
                    page = target;
                    loadingStatus.textContent = `Already on target page ${target}`;
                    return;
                }

                loadingStatus.textContent = `Current page: ${currentPage}, navigating to: ${target}`;
                const pageGap = Math.abs(currentPage - target);
                if (pageGap > 5) {
                    loadingStatus.textContent = `🚀 Direct navigation to page ${target} (${pageGap} page jump)`;

                    try {
                        const searchState: SearchState = {
                            usernames: userNamesToSearch,
                            foundUsers: foundUsers,
                            startRank: startRank,
                            endRank: endRank,
                            startPage: startPage,
                            endPage: endPage,
                            targetPage: target,
                            pageSize: pageSize,
                            resumeSearch: true,
                        };

                        sessionStorage.setItem(
                            "leetcodeSearchState",
                            JSON.stringify(searchState)
                        );

                        const currentUrl = window.location.href;
                        const targetUrl = currentUrl.replace(
                            /\/ranking\/\d+/,
                            `/ranking/${target}`
                        );

                        loadingStatus.textContent = `🔄 Navigating to page ${target}...`;

                        window.location.replace(targetUrl);
                        return;
                    } catch (error) {
                        loadingStatus.textContent = `❌ Direct navigation failed: ${
                            (error as Error).message
                        }`;
                        await navigateByButtons(currentPage, target);
                    }
                } else {
                    await navigateByButtons(currentPage, target);
                }
            }

            async function navigateByButtons(
                currentPage: number,
                targetPage: number
            ) {
                const getCurrentPageFromUrl = () => {
                    const match =
                        window.location.href.match(/\/ranking\/(\d+)/);
                    return match ? parseInt(match[1], 10) : 1;
                };

                page = currentPage;
                const pageGap = Math.abs(currentPage - targetPage);

                if (pageGap > 5) {
                    loadingStatus.textContent = `❌ Button navigation not suitable for ${pageGap} page jump`;
                    return;
                }

                if (page < targetPage) {
                    while (
                        page < targetPage &&
                        !(window as any).__stopLeetCodeSearch
                    ) {
                        loadingStatus.textContent = `➡️ ${page} → ${targetPage} (${
                            targetPage - page
                        } remaining)`;

                        const nextBtn = document.querySelector(
                            'button[aria-label="next"]'
                        ) as HTMLButtonElement;
                        if (
                            !nextBtn ||
                            nextBtn.disabled ||
                            nextBtn.classList.contains("cursor-not-allowed")
                        ) {
                            loadingStatus.textContent = `❌ Cannot navigate forward from page ${page}`;
                            break;
                        }
                        nextBtn.click();
                        await delay(600);

                        const newPage = getCurrentPageFromUrl();
                        if (newPage === page) {
                            loadingStatus.textContent = `❌ Navigation stuck at page ${page}`;
                            break;
                        }
                        page = newPage;
                        await delay(300);
                    }
                } else if (page > targetPage) {
                    while (
                        page > targetPage &&
                        !(window as any).__stopLeetCodeSearch
                    ) {
                        loadingStatus.textContent = `⬅️ ${page} → ${targetPage} (${
                            page - targetPage
                        } remaining)`;

                        const prevBtn = document.querySelector(
                            'button[aria-label="previous"]'
                        ) as HTMLButtonElement;
                        if (
                            !prevBtn ||
                            prevBtn.disabled ||
                            prevBtn.classList.contains("cursor-not-allowed")
                        ) {
                            loadingStatus.textContent = `❌ Cannot navigate backward from page ${page}`;
                            break;
                        }
                        prevBtn.click();
                        await delay(600);

                        const newPage = getCurrentPageFromUrl();
                        if (newPage === page) {
                            loadingStatus.textContent = `❌ Backward navigation stuck at page ${page}`;
                            break;
                        }
                        page = newPage;
                        await delay(300);
                    }
                }

                const finalPage = getCurrentPageFromUrl();
                if (finalPage === targetPage) {
                    loadingStatus.textContent = `✅ Successfully navigated to page ${targetPage}`;
                    await waitForPageToLoad(finalPage);
                } else {
                    loadingStatus.textContent = `⚠️ Ended up on page ${finalPage} instead of ${targetPage}`;
                }
                page = finalPage;
            }

            function pageRankRange(p: number): { start: number; end: number } {
                const start = (p - 1) * pageSize + 1;
                const end = p * pageSize;
                return { start, end };
            }

            async function searchAndClickNext() {
                running = true;
                (window as any).__stopLeetCodeSearch = false;

                foundUsers = {};
                const pendingMatches: PendingMatch[] = [];
                const list = document.getElementById("user-status-list")!;
                list.innerHTML = userNamesToSearch
                    .map(
                        (u) =>
                            `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u}</span><span id="user-${u}" style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:2px 6px;min-width:70px;text-align:center;font-size:11px;flex-shrink:0;">…</span></div>`
                    )
                    .join("");

                const getCurrentPageFromUrl = () => {
                    const match =
                        window.location.href.match(/\/ranking\/(\d+)/);
                    return match ? parseInt(match[1], 10) : 1;
                };

                // Only navigate if we're not already on the start page
                const currentUrlPage = getCurrentPageFromUrl();
                if (currentUrlPage !== startPage) {
                    await goToTargetPage(startPage);
                    if ((window as any).__stopLeetCodeSearch) {
                        running = false;
                        return;
                    }
                }

                page = getCurrentPageFromUrl();
                loadingStatus.textContent = `Starting search at rank ${startRank} (page ${page})`;

                while (!(window as any).__stopLeetCodeSearch) {
                    const actualPage = getCurrentPageFromUrl();
                    if (actualPage !== page) {
                        page = actualPage;
                    }

                    if (isFinite(endPage) && page > endPage) {
                        loadingStatus.textContent =
                            "✅ Finished (end rank reached)";
                        break;
                    }
                    const { start: pageStartRank, end: pageEndRank } =
                        pageRankRange(page);
                    if (endRank && pageStartRank > endRank) {
                        loadingStatus.textContent = "✅ Passed end rank";
                        break;
                    }

                    loadingStatus.textContent = `🔍 Scanning page ${page} (ranks ${pageStartRank}-${pageEndRank})`;

                    await waitForPageToLoad(page);
                    const nameDivs = Array.from(
                        document.querySelectorAll('a[href*="/u/"] .truncate')
                    );

                    let foundOnThisPage = 0;
                    const availableNames = nameDivs.map((div) =>
                        (div as HTMLElement).textContent!.trim()
                    );

                    for (const name of userNamesToSearch) {
                        if (!foundUsers[name]) {
                            const matchedName = await findFuzzyMatches(
                                name,
                                availableNames,
                                pendingMatches
                            );
                            if (matchedName) {
                                const userLink = Array.from(
                                    document.querySelectorAll('a[href*="/u/"]')
                                ).find(
                                    (link) =>
                                        link
                                            .querySelector(".truncate")
                                            ?.textContent?.trim() ===
                                        matchedName
                                ) as HTMLAnchorElement | undefined;
                                const profileUrl = userLink
                                    ? userLink.href
                                    : "";

                                foundUsers[name] = {
                                    page,
                                    actualName: matchedName,
                                    profileUrl,
                                };
                                const el = document.getElementById(
                                    `user-${name}`
                                );
                                if (el) {
                                    if (profileUrl) {
                                        el.innerHTML = `
                      <a href="${profileUrl}" target="_blank" style="color:#155724;text-decoration:none;margin-right:8px;">🔗 View</a>
                      <button class="add-to-squad-btn" data-username="${matchedName}" style="background:#2CBB5D;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">+ Squad</button>
                    `;

                                        const addBtn = el.querySelector(
                                            ".add-to-squad-btn"
                                        ) as HTMLButtonElement;
                                        if (addBtn) {
                                            addBtn.addEventListener(
                                                "click",
                                                (e) => {
                                                    e.preventDefault();
                                                    addToSquad(
                                                        matchedName,
                                                        addBtn
                                                    );
                                                }
                                            );
                                        }
                                    } else {
                                        el.textContent = `Page ${page}`;
                                    }
                                    el.style.background = "#d4edda";
                                    el.style.color = "#155724";
                                    el.style.cursor = "default";
                                    el.style.display = "flex";
                                    el.style.alignItems = "center";
                                    el.style.justifyContent = "flex-end";
                                    el.title = `Found as: ${matchedName}${
                                        profileUrl
                                            ? "\nClick to view profile or add to squad"
                                            : ""
                                    }`;
                                }
                                foundOnThisPage++;
                            }
                        }
                    }

                    if (foundOnThisPage > 0) {
                        loadingStatus.textContent = `✅ Found ${foundOnThisPage} user(s) on page ${page}`;
                        await delay(1000);
                    }

                    if (
                        Object.keys(foundUsers).length ===
                        userNamesToSearch.length
                    ) {
                        loadingStatus.textContent = "🎉 All users found!";
                        break;
                    }

                    const nextBtn = document.querySelector(
                        'button[aria-label="next"]'
                    ) as HTMLButtonElement;
                    if (
                        !nextBtn ||
                        nextBtn.disabled ||
                        nextBtn.classList.contains("cursor-not-allowed")
                    ) {
                        loadingStatus.textContent =
                            "⚠️ No more pages available";
                        break;
                    }

                    nextBtn.click();
                    await delay(1200);

                    const newPage = getCurrentPageFromUrl();
                    if (newPage === page) {
                        loadingStatus.textContent =
                            "❌ Navigation failed - stopping";
                        break;
                    }
                    page = newPage;
                    await waitForPageToLoad(page);
                }

                const totalCount = userNamesToSearch.length;

                // Show pending fuzzy matches for confirmation
                if (pendingMatches.length > 0) {
                    let confirmMessage = `Found ${pendingMatches.length} fuzzy match(es) that need confirmation:\n\n`;
                    pendingMatches.forEach((match, idx) => {
                        confirmMessage += `${idx + 1}. "${
                            match.searchName
                        }" → "${match.topMatch.name}" (${
                            match.topMatch.similarity
                        }% match)\n`;
                    });
                    confirmMessage += `\nAccept all these matches?`;

                    const acceptAll = confirm(confirmMessage);

                    if (!acceptAll) {
                        // Remove non-confirmed matches from foundUsers
                        pendingMatches.forEach((match) => {
                            delete foundUsers[match.searchName];
                            const el = document.getElementById(
                                `user-${match.searchName}`
                            );
                            if (el) {
                                el.textContent = "Not confirmed";
                                el.style.background = "#fff3cd";
                                el.style.color = "#856404";
                            }
                        });
                    }
                }

                const finalFoundCount = Object.keys(foundUsers).length;

                let summaryText = `✅ Search complete: ${finalFoundCount}/${totalCount} users found`;
                if (finalFoundCount > 0) {
                    summaryText += "\n\nMatches found:";
                    for (const [searchName, result] of Object.entries(
                        foundUsers
                    )) {
                        const actualName = result.actualName || searchName;
                        const profileUrl = result.profileUrl || "N/A";
                        const pageInfo = result.page;
                        summaryText += `\n• ${searchName} → ${actualName} (page ${pageInfo})`;
                        summaryText += `\n  Profile: ${profileUrl}`;
                    }
                }

                loadingStatus.textContent = summaryText;
                running = false;
            }

            function startSearch() {
                searchAndClickNext();
            }

            startSearch();
        }
    }

    window.addEventListener("load", () => {
        const savedState = sessionStorage.getItem("leetcodeSearchState");
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.resumeSearch) {
                console.log("🔄 Auto-resuming search after page navigation");
                findUsersInLeetCodeContest({});
            }
        }
    });

    chrome.runtime.onMessage.addListener(
        (
            request: SearchRequest,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response: SearchResponse) => void
        ) => {
            if (request.action === "startSearch") {
                if (
                    !window.location.href.includes("/contest/") ||
                    !window.location.href.includes("/ranking/")
                ) {
                    sendResponse({
                        status: "error",
                        message: "Not on a contest ranking page",
                    });
                    return;
                }

                try {
                    findUsersInLeetCodeContest(request);
                    sendResponse({ status: "started" });
                } catch (error) {
                    sendResponse({
                        status: "error",
                        message: (error as Error).message,
                    });
                }
            }
        }
    );
})();
