(() => {
  // Add a global stop flag
  window.__stopLeetCodeSearch = false;

  // =============================================================================
  // SQUAD MANAGEMENT - Add found users to friends
  // =============================================================================
  
  function addToSquad(username, buttonElement) {
    chrome.storage.local.get({ friends: [] }, (result) => {
      const friends = result.friends;
      
      if (friends.includes(username)) {
        buttonElement.textContent = '✓ In Squad';
        buttonElement.style.background = '#6c757d';
        buttonElement.disabled = true;
        
        setTimeout(() => {
          buttonElement.textContent = '✓ Already Added';
        }, 1000);
        return;
      }
      
      friends.push(username);
      chrome.storage.local.set({ friends }, () => {
        buttonElement.textContent = '✓ Added!';
        buttonElement.style.background = '#25a351';
        buttonElement.disabled = true;
        
        console.log(`Added ${username} to squad`);
      });
    });
  }

  // Fuzzy matching function to calculate similarity percentage
  function calculateSimilarity(str1, str2) {
    // Remove spaces and convert to lowercase for comparison
    const s1 = str1.replace(/\s+/g, '').toLowerCase();
    const s2 = str2.replace(/\s+/g, '').toLowerCase();
    
    if (s1 === s2) return 100;
    
    // Use Levenshtein distance for similarity calculation
    const matrix = [];
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0) return len2 === 0 ? 100 : 0;
    if (len2 === 0) return 0;
    
    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    return Math.round(((maxLength - distance) / maxLength) * 100);
  }

  // Function to find fuzzy matches with user confirmation
  async function findFuzzyMatches(searchName, availableNames) {
    const matches = [];
    
    for (const availableName of availableNames) {
      const similarity = calculateSimilarity(searchName, availableName);
      if (similarity >= 70) {
        matches.push({
          name: availableName,
          similarity: similarity
        });
      }
    }
    
    // Sort by similarity (highest first)
    matches.sort((a, b) => b.similarity - a.similarity);
    
    if (matches.length > 0) {
      const topMatch = matches[0];
      
      // Ask user for confirmation if similarity is not 100%
      if (topMatch.similarity < 100) {
        const confirmed = confirm(
          `Found potential match for "${searchName}":\n\n` +
          `• "${topMatch.name}" (${topMatch.similarity}% similarity)\n\n` +
          `Accept this match?`
        );
        
        if (!confirmed) {
          return null;
        }
      }
      
      return topMatch.name;
    }
    
    return null;
  }

  async function findUsersInLeetCodeContest(opts = {}) {
    // First check if we're on a contest ranking page
    if (!window.location.href.includes('/contest/') || !window.location.href.includes('/ranking/')) {
      alert('❌ Please open a LeetCode contest ranking page first!\nExample: https://leetcode.com/contest/weekly-contest-465/ranking/1/');
      return;
    }
    
    let userNamesToSearch = [];
    let foundUsers = {};
    let page = 1;
    let running = false;
    let pageSize = opts.pageSize || 25;
    let startRank = parseInt(opts.startRank, 10) || 1;
    let endRank = opts.endRank ? parseInt(opts.endRank, 10) : undefined;
    let startPage = parseInt(opts.startPage, 10) || 1;
    let endPage = opts.endPage ? parseInt(opts.endPage, 10) : Infinity;
    
    // Check if we're resuming a search after navigation
    const savedState = sessionStorage.getItem('leetcodeSearchState');
    if (savedState) {
      const state = JSON.parse(savedState);
      if (state.resumeSearch) {
        // Clear the saved state
        sessionStorage.removeItem('leetcodeSearchState');
        
        // Restore search parameters
        userNamesToSearch = state.usernames || [];
        foundUsers = state.foundUsers || {};
        
        // Handle both old format (page number) and new format (object with profileUrl and actualName)
        for (const [key, value] of Object.entries(foundUsers)) {
          if (typeof value === 'number') {
            foundUsers[key] = { page: value, actualName: key, profileUrl: '' };
          } else if (value && !value.profileUrl) {
            value.profileUrl = '';
          }
        }
        startRank = state.startRank;
        endRank = state.endRank;
        startPage = state.startPage;
        endPage = state.endPage;
        pageSize = state.pageSize || 25;
        
        console.log('🔄 Resuming search after navigation to target page');
        
        // Skip the normal initialization and go straight to search
        createDialogAndStartSearch();
        return;
      } else {
        // Clear old state
        sessionStorage.removeItem('leetcodeSearchState');
      }
    }
    
    // Get usernames from popup (normal startup)
    const usernamesFromPopup = opts.usernames || '';
    userNamesToSearch = usernamesFromPopup.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    
    if (!userNamesToSearch.length) {
      alert('No valid usernames provided.');
      return;
    }
    
    createDialogAndStartSearch();
    
    function createDialogAndStartSearch() {

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const existingDialog = document.getElementById("leetcode-search-dialog");
    if (existingDialog) existingDialog.remove();

    const dialog = document.createElement("div");
    dialog.id = "leetcode-search-dialog";
    dialog.style.position = "fixed";
    dialog.style.top = "10px";
    dialog.style.right = "10px";
    dialog.style.padding = "16px";
    dialog.style.backgroundColor = "#fff";
    dialog.style.border = "1px solid #d0d7de";
    dialog.style.borderRadius = "10px";
    dialog.style.zIndex = 99999;
    dialog.style.width = "300px";
    dialog.style.fontFamily = "system-ui,Segoe UI,Arial,sans-serif";
    dialog.style.fontSize = "13px";
    dialog.style.boxShadow = "0 4px 18px rgba(0,0,0,.15)";
    dialog.style.color = "#111";
    dialog.style.lineHeight = "1.35";

    dialog.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <strong style="font-size:15px;">Rank Search</strong>
        <button id="closeBtn" style="background:none;border:none;font-size:20px;line-height:1;cursor:pointer;color:#444;">×</button>
      </div>
      <div style="display:flex;gap:6px;margin-bottom:8px;">
        <input id="lc-start-rank" type="number" min="1" value="${startRank}" style="flex:1;background-color:#fff;padding:4px 6px;border:1px solid #ccc;border-radius:6px;" title="Start Rank" />
        <input id="lc-end-rank" type="number" min="1" value="${endRank ? endRank : ''}" style="flex:1;background-color:#fff;padding:4px 6px;border:1px solid #ccc;border-radius:6px;" placeholder="End" title="End Rank (optional)" />
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

    const loadingStatus = document.getElementById("loading-status");
    const rangeStatus = document.getElementById("range-status");

    function updateRangeStatus() {
      const low = startRank;
      const high = endRank ? endRank : '…';
      rangeStatus.textContent = `Scanning ranks ${low} → ${high} (pages ${startPage} to ${isFinite(endPage) ? endPage : '…'})`;
    }
    updateRangeStatus();

    document.getElementById("closeBtn").onclick = () => { window.__stopLeetCodeSearch = true; dialog.remove(); };
    document.getElementById("stopBtn").onclick = () => { window.__stopLeetCodeSearch = true; };

    document.getElementById("rerunBtn").onclick = () => {
      if (running) { alert("Search already running."); return; }
      const sr = parseInt(document.getElementById('lc-start-rank').value, 10) || 1;
      const erRaw = document.getElementById('lc-end-rank').value.trim();
      const er = erRaw === '' ? undefined : parseInt(erRaw, 10);
      if (er && er < sr) { alert('End rank must be >= start rank'); return; }
      startRank = sr; endRank = er;
      startPage = Math.floor((startRank - 1) / pageSize) + 1;
      endPage = endRank ? Math.floor((endRank - 1) / pageSize) + 1 : Infinity;
      updateRangeStatus();
      
      // Reset found users and restart search
      foundUsers = {};
      const list = document.getElementById('user-status-list');
      list.innerHTML = userNamesToSearch.map(u => `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u}</span><span id="user-${u}" style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:2px 6px;min-width:70px;text-align:center;font-size:11px;flex-shrink:0;">…</span></div>`).join('');
      
      searchAndClickNext();
    };

    async function waitForPageToLoad(pageNumber, timeout = 15000) {
      loadingStatus.textContent = `Loading page ${pageNumber}…`;
      const checkInt = 300;
      const maxAttempts = Math.floor(timeout / checkInt);
      let lastCount = 0, stable = 0;
      for (let i = 0; i < maxAttempts; i++) {
        if (window.__stopLeetCodeSearch) return false;
        await delay(checkInt);
        const nameDivs = document.querySelectorAll('a[href*="/u/"] .truncate');
        const count = nameDivs.length;
        const spinner = document.querySelector('.loading,.spinner,[data-loading="true"]');
        if (count >= 5 && !spinner) {
          if (count === lastCount) {
            stable++;
            if (stable >= 3) { loadingStatus.textContent = `Page ${pageNumber} ready (${count})`; return true; }
          } else { stable = 0; lastCount = count; }
        }
        if (i % 5 === 0) loadingStatus.textContent = `Loading page ${pageNumber}… (${count})`;
      }
      return true; // proceed even if partial
    }

    async function goToTargetPage(target) {
      // Function to get current page from URL
      const getCurrentPageFromUrl = () => {
        const match = window.location.href.match(/\/ranking\/(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
      };
      
      const currentPage = getCurrentPageFromUrl();
      loadingStatus.textContent = `Current page: ${currentPage}, navigating to: ${target}`;
      
      // If we're already at the target page, no need to navigate
      if (currentPage === target) {
        page = target;
        loadingStatus.textContent = `Already on target page ${target}`;
        return;
      }
      
      // For any page difference > 5, use direct URL navigation with state preservation
      const pageGap = Math.abs(currentPage - target);
      if (pageGap > 5) {
        loadingStatus.textContent = `🚀 Direct navigation to page ${target} (${pageGap} page jump)`;
        
        try {
          // Store current search state
          const searchState = {
            usernames: userNamesToSearch,
            foundUsers: foundUsers,
            startRank: startRank,
            endRank: endRank,
            startPage: startPage,
            endPage: endPage,
            targetPage: target,
            pageSize: pageSize,
            resumeSearch: true
          };
          
          // Store state in sessionStorage to survive page navigation
          sessionStorage.setItem('leetcodeSearchState', JSON.stringify(searchState));
          
          // Construct target URL
          const currentUrl = window.location.href;
          const targetUrl = currentUrl.replace(/\/ranking\/\d+/, `/ranking/${target}`);
          
          loadingStatus.textContent = `🔄 Navigating to page ${target}...`;
          
          // Use location.replace to navigate while preserving extension context
          window.location.replace(targetUrl);
          
          // The page will reload and the extension will restart
          // The restoration logic will handle resuming the search
          return;
          
        } catch (error) {
          loadingStatus.textContent = `❌ Direct navigation failed: ${error.message}`;
          // Fallback to button navigation for small jumps only
          await navigateByButtons(currentPage, target);
        }
      } else {
        // For small page differences (≤5), use button navigation
        await navigateByButtons(currentPage, target);
      }
    }
    
    async function navigateByButtons(currentPage, targetPage) {
      // Function to get current page from URL
      const getCurrentPageFromUrl = () => {
        const match = window.location.href.match(/\/ranking\/(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
      };
      
      page = currentPage;
      const pageGap = Math.abs(currentPage - targetPage);
      
      // Only handle small page differences with button navigation
      if (pageGap > 5) {
        loadingStatus.textContent = `❌ Button navigation not suitable for ${pageGap} page jump`;
        return;
      }
      
      // Quick navigation for small differences
      if (page < targetPage) {
        // Navigate forward
        while (page < targetPage && !window.__stopLeetCodeSearch) {
          loadingStatus.textContent = `➡️ ${page} → ${targetPage} (${targetPage - page} remaining)`;
          
          const nextBtn = document.querySelector('button[aria-label="next"]');
          if (!nextBtn || nextBtn.disabled || nextBtn.classList.contains('cursor-not-allowed')) {
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
          await delay(300); // Quick wait between pages
        }
      } else if (page > targetPage) {
        // Navigate backward
        while (page > targetPage && !window.__stopLeetCodeSearch) {
          loadingStatus.textContent = `⬅️ ${page} → ${targetPage} (${page - targetPage} remaining)`;
          
          const prevBtn = document.querySelector('button[aria-label="previous"]');
          if (!prevBtn || prevBtn.disabled || prevBtn.classList.contains('cursor-not-allowed')) {
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
      
      // Final verification
      const finalPage = getCurrentPageFromUrl();
      if (finalPage === targetPage) {
        loadingStatus.textContent = `✅ Successfully navigated to page ${targetPage}`;
        await waitForPageToLoad(finalPage);
      } else {
        loadingStatus.textContent = `⚠️ Ended up on page ${finalPage} instead of ${targetPage}`;
      }
      page = finalPage;
    }

    function pageRankRange(p) {
      const start = (p - 1) * pageSize + 1;
      const end = p * pageSize;
      return { start, end };
    }

    async function searchAndClickNext() {
      running = true; window.__stopLeetCodeSearch = false;
      
      // Initialize the user status list first
      foundUsers = {};
      const list = document.getElementById('user-status-list');
      list.innerHTML = userNamesToSearch.map(u => `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:8px;"><span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u}</span><span id="user-${u}" style="background:#fff;border:1px solid #ccc;border-radius:4px;padding:2px 6px;min-width:70px;text-align:center;font-size:11px;flex-shrink:0;">…</span></div>`).join('');
      
      await goToTargetPage(startPage);
      if (window.__stopLeetCodeSearch) { running = false; return; }
      
      // Function to get current page from URL
      const getCurrentPageFromUrl = () => {
        const match = window.location.href.match(/\/ranking\/(\d+)/);
        return match ? parseInt(match[1], 10) : 1;
      };
      
      // Set page counter to actual current page after navigation
      page = getCurrentPageFromUrl();
      loadingStatus.textContent = `Starting search at rank ${startRank} (page ${page})`;

      while (!window.__stopLeetCodeSearch) {
        // Always check current page from URL to ensure accuracy
        const actualPage = getCurrentPageFromUrl();
        if (actualPage !== page) {
          page = actualPage;
        }
        
        if (isFinite(endPage) && page > endPage) { loadingStatus.textContent = '✅ Finished (end rank reached)'; break; }
        const { start: pageStartRank, end: pageEndRank } = pageRankRange(page);
        if (endRank && pageStartRank > endRank) { loadingStatus.textContent = '✅ Passed end rank'; break; }

        loadingStatus.textContent = `🔍 Scanning page ${page} (ranks ${pageStartRank}-${pageEndRank})`;

        await waitForPageToLoad(page);
        const nameDivs = Array.from(document.querySelectorAll('a[href*="/u/"] .truncate'));

        // Search for users on current page
        let foundOnThisPage = 0;
        const availableNames = nameDivs.map(div => div.textContent.trim());
        
        for (const name of userNamesToSearch) {
          if (!foundUsers[name]) {
            // Try fuzzy matching
            const matchedName = await findFuzzyMatches(name, availableNames);
            if (matchedName) {
              // Find the profile URL for this user
              const userLink = Array.from(document.querySelectorAll('a[href*="/u/"]')).find(
                link => link.querySelector('.truncate')?.textContent.trim() === matchedName
              );
              const profileUrl = userLink ? userLink.href : '';
              
              foundUsers[name] = { page, actualName: matchedName, profileUrl }; 
              const el = document.getElementById(`user-${name}`); 
              if (el) {
                // Replace the status element with profile link and add to squad button
                const parent = el.parentElement;
                if (profileUrl) {
                  el.innerHTML = `
                    <a href="${profileUrl}" target="_blank" style="color:#155724;text-decoration:none;margin-right:8px;">🔗 View</a>
                    <button class="add-to-squad-btn" data-username="${matchedName}" style="background:#2CBB5D;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;font-weight:600;">+ Squad</button>
                  `;
                  
                  // Add click handler for "Add to Squad" button
                  const addBtn = el.querySelector('.add-to-squad-btn');
                  if (addBtn) {
                    addBtn.addEventListener('click', (e) => {
                      e.preventDefault();
                      addToSquad(matchedName, addBtn);
                    });
                  }
                } else {
                  el.textContent = `Page ${page}`;
                }
                el.style.background = '#d4edda';
                el.style.color = '#155724';
                el.style.cursor = 'default';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'flex-end';
                el.title = `Found as: ${matchedName}${profileUrl ? '\nClick to view profile or add to squad' : ''}`;
              }
              foundOnThisPage++;
            }
          }
        }

        if (foundOnThisPage > 0) {
          loadingStatus.textContent = `✅ Found ${foundOnThisPage} user(s) on page ${page}`;
          await delay(1000); // Show success message briefly
        }

        if (Object.keys(foundUsers).length === userNamesToSearch.length) { 
          loadingStatus.textContent = '🎉 All users found!'; 
          break; 
        }

        const nextBtn = document.querySelector('button[aria-label="next"]');
        if (!nextBtn || nextBtn.disabled || nextBtn.classList.contains('cursor-not-allowed')) { 
          loadingStatus.textContent = '⚠️ No more pages available'; 
          break; 
        }
        
        nextBtn.click(); 
        await delay(1200);
        
        // Wait for page to load and verify we moved
        const newPage = getCurrentPageFromUrl();
        if (newPage === page) {
          loadingStatus.textContent = '❌ Navigation failed - stopping';
          break;
        }
        page = newPage;
        await waitForPageToLoad(page);
      }
      
      // Final summary
      const foundCount = Object.keys(foundUsers).length;
      const totalCount = userNamesToSearch.length;
      
      let summaryText = `✅ Search complete: ${foundCount}/${totalCount} users found`;
      if (foundCount > 0) {
        summaryText += '\n\nMatches found:';
        for (const [searchName, result] of Object.entries(foundUsers)) {
          const actualName = result.actualName || searchName;
          const profileUrl = result.profileUrl || 'N/A';
          const pageInfo = typeof result === 'object' ? result.page : result;
          summaryText += `\n• ${searchName} → ${actualName} (page ${pageInfo})`;
          summaryText += `\n  Profile: ${profileUrl}`;
        }
      }
      
      loadingStatus.textContent = summaryText;
      running = false;
    }

    function startSearch() {
      // usernames already set from popup, just start searching
      searchAndClickNext();
    }

    startSearch();
    } // Close createDialogAndStartSearch function
  } // Close findUsersInLeetCodeContest function

  // Auto-resume check on page load
  window.addEventListener('load', () => {
    const savedState = sessionStorage.getItem('leetcodeSearchState');
    if (savedState) {
      const state = JSON.parse(savedState);
      if (state.resumeSearch) {
        console.log('🔄 Auto-resuming search after page navigation');
        findUsersInLeetCodeContest({});
      }
    }
  });

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSearch') {
      // Check if we're on the right page before starting
      if (!window.location.href.includes('/contest/') || !window.location.href.includes('/ranking/')) {
        sendResponse({ status: 'error', message: 'Not on a contest ranking page' });
        return;
      }
      
      try {
        findUsersInLeetCodeContest(request);
        sendResponse({ status: 'started' });
      } catch (error) {
        sendResponse({ status: 'error', message: error.message });
      }
    }
  });
})();