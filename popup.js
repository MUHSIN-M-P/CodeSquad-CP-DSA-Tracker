// CodeSquad Tracker -   Popup
// Manages tabs, friends, and search functionality

// =============================================================================
// TAB MANAGEMENT
// =============================================================================

const tabs = document.querySelectorAll('.tab');
const tabPanels = document.querySelectorAll('.tab-panel');
const tabIndicator = document.querySelector('.tab-indicator');

tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
        // Update active states
        tabs.forEach(t => t.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById(`${tabName}-tab`).classList.add('active');
        
        // Update indicator position
        updateTabIndicator(index);
        
        // Load data when switching tabs
        if (tabName === 'squad') {
            loadSquadRankings();
        } else if (tabName === 'activity') {
            loadDailyActivity();
        }
    });
});

function updateTabIndicator(index) {
    const tabWidth = 100 / tabs.length;
    tabIndicator.style.left = `${index * tabWidth}%`;
    tabIndicator.style.width = `${tabWidth}%`;
}

// Initialize indicator position
updateTabIndicator(0);

// =============================================================================
// ERROR HANDLING
// =============================================================================

const errorBox = document.getElementById('errorBox');

function showError(msg) {
    errorBox.textContent = msg;
    errorBox.style.display = 'block';
    setTimeout(() => {
        errorBox.style.display = 'none';
    }, 5000);
}

function clearError() {
    errorBox.style.display = 'none';
}

// =============================================================================
// SEARCH FUNCTIONALITY (Existing Feature)
// =============================================================================

document.getElementById('startSearchBtn').addEventListener('click', () => {
    clearError();
    
    const usernamesEl = document.getElementById('usernames');
    const startRankEl = document.getElementById('startRank');
    const endRankEl = document.getElementById('endRank');
    
    const usernames = usernamesEl.value.trim();
    const startRank = startRankEl.value ? parseInt(startRankEl.value, 10) : 1;
    const endRank = endRankEl.value ? parseInt(endRankEl.value, 10) : undefined;

    if (!usernames) {
        return showError('Please enter at least one username.');
    }
    if (startRank < 1) {
        return showError('Start rank must be at least 1.');
    }
    if (endRank && endRank < startRank) {
        return showError('End rank must be >= start rank.');
    }

    // Convert ranks to pages (25 per page)
    const rankToPage = (rank) => Math.floor((rank - 1) / 25) + 1;
    const startPage = rankToPage(startRank);
    const endPage = endRank ? rankToPage(endRank) : undefined;

    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const currentTab = tabs[0];
        
        // Check if we're on a LeetCode contest ranking page
        if (!currentTab.url || !currentTab.url.includes('leetcode.com/contest/') || !currentTab.url.includes('/ranking/')) {
            showError('Please open a LeetCode contest ranking page first.\nExample: https://leetcode.com/contest/weekly-contest-XXX/ranking/1/');
            return;
        }
        
        chrome.tabs.sendMessage(currentTab.id, {
            action: 'startSearch',
            startPage,
            endPage,
            startRank,
            endRank,
            usernames: usernames,
            pageSize: 25
        }, response => {
            // Check for chrome.runtime.lastError to prevent console errors
            if (chrome.runtime.lastError) {
                showError('Cannot connect to page. Please refresh the contest ranking page and try again.');
                return;
            }
            
            if (response && response.status === 'started') {
                window.close();
            } else if (response && response.status === 'error') {
                if (response.message === 'Not on a contest ranking page') {
                    showError('Please open a LeetCode contest ranking page first.');
                } else {
                    showError('Error: ' + response.message);
                }
            } else {
                showError('Failed to start. Please refresh the page and try again.');
            }
        });
    });
});

// =============================================================================
// FRIENDS MANAGEMENT
// =============================================================================

const friendUsernameInput = document.getElementById('friendUsername');
const addFriendBtn = document.getElementById('addFriendBtn');
const squadList = document.getElementById('squadList');
const friendCount = document.getElementById('friendCount');

// Add friend
addFriendBtn.addEventListener('click', async () => {
    const username = friendUsernameInput.value.trim();
    
    if (!username) {
        showError('Please enter a username');
        return;
    }
    
    // Verify user exists via GraphQL
    const isValid = await verifyLeetCodeUser(username);
    
    if (!isValid) {
        showError(`User "${username}" not found on LeetCode`);
        return;
    }
    
    // Get existing friends
    chrome.storage.local.get({ friends: [] }, (result) => {
        const friends = result.friends;
        
        if (friends.includes(username)) {
            showError(`${username} is already in your squad`);
            return;
        }
        
        friends.push(username);
        chrome.storage.local.set({ friends }, () => {
            friendUsernameInput.value = '';
            loadSquadRankings();
            showSuccess(`Added ${username} to your squad!`);
        });
    });
});

// Allow Enter key to add friend
friendUsernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addFriendBtn.click();
    }
});

// Load and display friends
function loadFriends() {
    // This function is kept for compatibility but now redirects to squad rankings
    loadSquadRankings();
}

// Remove friend
function removeFriend(username) {
    if (!confirm(`Remove ${username} from your squad?`)) {
        return;
    }
    
    chrome.storage.local.get({ friends: [] }, (result) => {
        const friends = result.friends.filter(f => f !== username);
        chrome.storage.local.set({ friends }, () => {
            loadSquadRankings();
            loadDailyActivity(); // Refresh activity too
        });
    });
}

// View profile
function viewProfile(username) {
    const url = `https://leetcode.com/u/${username}/`;
    chrome.tabs.create({ url });
}

// Success message helper
function showSuccess(msg) {
    // Create temporary success notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: #2CBB5D;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideDown 0.3s ease;
    `;
    notification.textContent = '✓ ' + msg;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// =============================================================================
// GRAPHQL QUERIES
// =============================================================================

async function verifyLeetCodeUser(username) {
    const query = `
        query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                username
                profile {
                    realName
                    userAvatar
                }
            }
        }
    `;
    
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { username }
            })
        });
        
        const result = await response.json();
        return result.data?.matchedUser !== null;
    } catch (error) {
        console.error('Error verifying user:', error);
        return false;
    }
}

async function getUserStats(username) {
    const query = `
        query getUserProfile($username: String!) {
            matchedUser(username: $username) {
                username
                profile {
                    realName
                    userAvatar
                    ranking
                }
                submitStats {
                    acSubmissionNum {
                        difficulty
                        count
                    }
                }
            }
        }
    `;
    
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { username }
            })
        });
        
        const result = await response.json();
        return result.data?.matchedUser;
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return null;
    }
}

// =============================================================================
// SQUAD RANKINGS (Merged Leaderboard + Friends)
// =============================================================================

async function loadSquadRankings() {
    chrome.storage.local.get({ friends: [] }, async (result) => {
        const friends = result.friends;
        friendCount.textContent = friends.length;
        
        if (friends.length === 0) {
            squadList.innerHTML = `
                <div class="empty-state">
                    <p>👥 No squad members yet</p>
                    <small>Add friends to see their rankings</small>
                </div>
            `;
            return;
        }
        
        // Show loading
        squadList.innerHTML = `
            <div class="empty-state">
                <p>⏳ Loading rankings...</p>
            </div>
        `;
        
        // Fetch stats for all friends
        const statsPromises = friends.map(friend => getUserStats(friend));
        const allStats = await Promise.all(statsPromises);
        
        // Filter out null results and sort by total problems solved
        const validStats = allStats
            .filter(stat => stat !== null)
            .map(stat => {
                const acStats = stat.submitStats.acSubmissionNum;
                const total = acStats.find(s => s.difficulty === 'All')?.count || 0;
                return {
                    username: stat.username,
                    avatar: stat.profile.userAvatar,
                    ranking: stat.profile.ranking,
                    total,
                    easy: acStats.find(s => s.difficulty === 'Easy')?.count || 0,
                    medium: acStats.find(s => s.difficulty === 'Medium')?.count || 0,
                    hard: acStats.find(s => s.difficulty === 'Hard')?.count || 0
                };
            })
            .sort((a, b) => b.total - a.total);
        
        if (validStats.length === 0) {
            squadList.innerHTML = `
                <div class="empty-state">
                    <p>❌ Failed to load data</p>
                    <small>Check your internet connection</small>
                </div>
            `;
            return;
        }
        
        // Display squad members with rankings
        squadList.innerHTML = validStats.map((user, index) => {
            const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            
            return `
                <div class="leaderboard-item">
                    <div class="rank ${rankClass}">${medal}</div>
                    <div class="friend-avatar">${user.username[0].toUpperCase()}</div>
                    <div class="user-details">
                        <div class="name">${user.username}</div>
                        <div class="stats">
                            <span style="color: #2CBB5D">${user.easy}E</span> · 
                            <span style="color: #FFA116">${user.medium}M</span> · 
                            <span style="color: #EF4743">${user.hard}H</span>
                        </div>
                    </div>
                    <div class="score">${user.total}</div>
                    <div class="friend-actions">
                        <button class="btn-icon btn-view" title="View Profile" onclick="viewProfile('${user.username}')">
                            🔗
                        </button>
                        <button class="btn-icon btn-remove" title="Remove" onclick="removeFriend('${user.username}')">
                            ✕
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    });
}

// =============================================================================
// DAILY ACTIVITY (Questions Solved Today)
// =============================================================================

async function loadDailyActivity() {
    const activityContent = document.getElementById('activityContent');
    
    chrome.storage.local.get({ friends: [] }, async (result) => {
        const friends = result.friends;
        
        if (friends.length === 0) {
            activityContent.innerHTML = `
                <div class="empty-state">
                    <p>📊 No activity yet</p>
                    <small>Add squad members to see daily activity</small>
                </div>
            `;
            return;
        }
        
        // Show loading
        activityContent.innerHTML = `
            <div class="empty-state">
                <p>⏳ Loading today's activity...</p>
            </div>
        `;
        
        // Fetch recent submissions for all friends
        const submissionsPromises = friends.map(friend => getRecentSubmissions(friend, 20));
        const allSubmissions = await Promise.all(submissionsPromises);
        
        // Filter for today's submissions and count them
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dailyStats = allSubmissions
            .map((submissions, index) => {
                if (!submissions || submissions.length === 0) {
                    return { username: friends[index], count: 0, submissions: [] };
                }
                
                const todaySubmissions = submissions.filter(sub => {
                    const subDate = new Date(sub.timestamp * 1000);
                    subDate.setHours(0, 0, 0, 0);
                    return subDate.getTime() === today.getTime();
                });
                
                // Get unique problems solved today
                const uniqueProblems = new Set(todaySubmissions.map(s => s.titleSlug));
                
                return {
                    username: submissions[0]?.username || friends[index],
                    count: uniqueProblems.size,
                    submissions: todaySubmissions
                };
            })
            .sort((a, b) => b.count - a.count);
        
        if (dailyStats.every(stat => stat.count === 0)) {
            activityContent.innerHTML = `
                <div class="empty-state">
                    <p>😴 No activity today</p>
                    <small>Your squad hasn't solved any problems yet today</small>
                </div>
            `;
            return;
        }
        
        // Display daily activity leaderboard
        activityContent.innerHTML = dailyStats.map((user, index) => {
            const rankClass = index === 0 && user.count > 0 ? 'gold' : index === 1 && user.count > 0 ? 'silver' : index === 2 && user.count > 0 ? 'bronze' : '';
            const medal = index === 0 && user.count > 0 ? '🥇' : index === 1 && user.count > 0 ? '🥈' : index === 2 && user.count > 0 ? '🥉' : `#${index + 1}`;
            const emoji = user.count === 0 ? '💤' : user.count >= 5 ? '🔥' : user.count >= 3 ? '⚡' : '✓';
            
            return `
                <div class="leaderboard-item" style="opacity: ${user.count === 0 ? 0.5 : 1}">
                    <div class="rank ${rankClass}">${medal}</div>
                    <div class="friend-avatar">${user.username[0].toUpperCase()}</div>
                    <div class="user-details">
                        <div class="name">${user.username}</div>
                        <div class="stats">
                            ${user.count > 0 ? `${emoji} ${user.count} problem${user.count !== 1 ? 's' : ''} today` : 'No activity'}
                        </div>
                    </div>
                    <div class="score" style="color: ${user.count >= 3 ? '#2CBB5D' : user.count > 0 ? '#FFA116' : 'var(--text-secondary)'}">${user.count}</div>
                </div>
            `;
        }).join('');
    });
}

// =============================================================================
// GRAPHQL QUERIES
// =============================================================================

async function getRecentSubmissions(username, limit = 20) {
    const query = `
        query recentSubmissions($username: String!, $limit: Int!) {
            recentAcSubmissionList(username: $username, limit: $limit) {
                title
                titleSlug
                timestamp
            }
        }
    `;
    
    try {
        const response = await fetch('https://leetcode.com/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { username, limit }
            })
        });
        
        const result = await response.json();
        const submissions = result.data?.recentAcSubmissionList || [];
        return submissions.map(s => ({ ...s, username }));
    } catch (error) {
        console.error('Error fetching submissions:', error);
        return [];
    }
}

// Load squad on startup
document.addEventListener('DOMContentLoaded', () => {
    loadSquadRankings();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideDown {
        from { transform: translate(-50%, -20px); opacity: 0; }
        to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes slideUp {
        from { transform: translate(-50%, 0); opacity: 1; }
        to { transform: translate(-50%, -20px); opacity: 0; }
    }
`;
document.head.appendChild(style);
