import React, { useState, useEffect, useRef } from "react";
import { getUserStats, verifyLeetCodeUser } from "../utils/leetcode-api";
import {
    getCodeforcesUserStats,
    verifyCodeforcesUser,
    getCodeforcesRankColor,
} from "../utils/codeforces-api";
import type { UserStats, Platform, Friend } from "../types";

interface SquadTabProps {
    showError: (msg: string) => void;
}

interface DisplayMember {
    id: string;
    mainUsername: string;
    mainPlatform: Platform;
    profiles: Friend[];
    stats: UserStats[];
}

const SquadTab: React.FC<SquadTabProps> = ({ showError }) => {
    const [friendUsername, setFriendUsername] = useState("");
    const [selectedPlatform, setSelectedPlatform] =
        useState<Platform>("leetcode");
    const [friends, setFriends] = useState<Friend[]>([]);
    const [squadStats, setSquadStats] = useState<UserStats[]>([]);
    const [loading, setLoading] = useState(false);
    const [draggedMember, setDraggedMember] = useState<string | null>(null);
    const [dragOverMember, setDragOverMember] = useState<string | null>(null);
    const [dragStartPos, setDragStartPos] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [isDraggable, setIsDraggable] = useState(false);
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollIntervalRef = useRef<number | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadSquadRankings(false);
    }, []);

    // Generate unique IDs for friends
    const generateId = (username: string, platform: Platform) =>
        `${username}-${platform}`;

    // Auto-merge friends with similar usernames (only LC + CF)
    const autoMergeFriends = (friendsList: Friend[]): Friend[] => {
        const result: Friend[] = [];
        const processed = new Set<string>();

        friendsList.forEach((friend) => {
            const friendId = generateId(friend.username, friend.platform);
            if (processed.has(friendId)) return;

            // Look for matches across platforms (only LC + CF, not same platform)
            const matches = friendsList.filter(
                (f) =>
                    f.username.toLowerCase() ===
                    friend.username.toLowerCase() &&
                    f.platform !== friend.platform &&
                    !processed.has(generateId(f.username, f.platform))
            );

            // Only merge if we have exactly one match (one LC + one CF)
            if (matches.length === 1) {
                // Create merged friend
                const merged: Friend = {
                    ...friend,
                    id: generateId(friend.username, friend.platform),
                    mergedWith: matches.map((m) => ({
                        ...m,
                        id: generateId(m.username, m.platform),
                    })),
                };
                result.push(merged);
                processed.add(friendId);
                matches.forEach((m) =>
                    processed.add(generateId(m.username, m.platform))
                );
            } else {
                result.push({
                    ...friend,
                    id: generateId(friend.username, friend.platform),
                });
                processed.add(friendId);
            }
        });

        return result;
    };

    // Get display members from friends list
    const getDisplayMembers = (
        friendsList: Friend[],
        stats: UserStats[]
    ): DisplayMember[] => {
        const members: DisplayMember[] = [];

        friendsList.forEach((friend) => {
            const profiles = [friend, ...(friend.mergedWith || [])];
            const memberStats = stats.filter((s) =>
                profiles.some(
                    (p) =>
                        p.username.trim().toLowerCase() ===
                        s.username.trim().toLowerCase() &&
                        p.platform === s.platform
                )
            );

            // Use displayName if set, otherwise use username
            const displayName = friend.displayName || friend.username;

            members.push({
                id: friend.id || generateId(friend.username, friend.platform),
                mainUsername: displayName,
                mainPlatform: friend.platform,
                profiles,
                stats: memberStats,
            });
        });

        // Sort by total problems solved
        return members.sort((a, b) => {
            const aTotal = a.stats.reduce((sum, s) => sum + s.total, 0);
            const bTotal = b.stats.reduce((sum, s) => sum + s.total, 0);
            return bTotal - aTotal;
        });
    };

    const loadSquadRankings = async (forceRefresh: boolean = false) => {
        chrome.storage.local.get(
            { friends: [], userStatsCache: {} },
            async (result) => {
                let friendsList: Friend[] = result.friends;
                let cache: Record<string, UserStats> =
                    result.userStatsCache || {};

                // Migrate old format to new format if needed
                if (
                    friendsList.length > 0 &&
                    typeof friendsList[0] === "string"
                ) {
                    friendsList = friendsList.map((f: any) => ({
                        username: f,
                        platform: "leetcode" as Platform,
                    }));
                }

                // Auto-merge friends with similar usernames
                friendsList = autoMergeFriends(friendsList);

                // Save merged list
                chrome.storage.local.set({ friends: friendsList });

                setFriends(friendsList);

                if (friendsList.length === 0) {
                    setSquadStats([]);
                    return;
                }

                const now = Date.now();
                const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

                // Collect all profiles including merged ones
                const allProfiles: Friend[] = [];
                friendsList.forEach((friend) => {
                    allProfiles.push(friend);
                    if (friend.mergedWith) {
                        allProfiles.push(...friend.mergedWith);
                    }
                });

                // Show cached data instantly
                const cachedStats = allProfiles
                    .map((profile) => {
                        const cacheKey = `${profile.username}-${profile.platform}`;
                        return cache[cacheKey];
                    })
                    .filter(
                        (stat): stat is UserStats =>
                            stat !== null && stat !== undefined
                    );

                if (cachedStats.length > 0) {
                    setSquadStats(cachedStats);
                }

                // Check if we need to refresh
                const needsRefresh =
                    forceRefresh ||
                    allProfiles.some((profile) => {
                        const cacheKey = `${profile.username}-${profile.platform}`;
                        const cachedData = cache[cacheKey];
                        return (
                            !cachedData ||
                            !cachedData.cachedAt ||
                            now - cachedData.cachedAt >= CACHE_DURATION
                        );
                    });

                if (!needsRefresh) {
                    return;
                }

                // Fetch updates in background
                setLoading(true);
                const statsPromises = allProfiles.map(
                    async (profile: Friend) => {
                        const cacheKey = `${profile.username}-${profile.platform}`;
                        const cachedData = cache[cacheKey];

                        // Use cache if fresh and not force refresh
                        if (
                            !forceRefresh &&
                            cachedData &&
                            cachedData.cachedAt &&
                            now - cachedData.cachedAt < CACHE_DURATION
                        ) {
                            return cachedData;
                        }

                        // Fetch fresh data
                        try {
                            const freshData =
                                profile.platform === "leetcode"
                                    ? await getUserStats(profile.username, cachedData)
                                    : await getCodeforcesUserStats(
                                        profile.username
                                    );

                            if (freshData) {
                                freshData.cachedAt = now;
                                freshData.lastFetched = now;
                                // Preserve yesterdayTotal and yesterdayDate from cached data if not set
                                if (cachedData && profile.platform === "leetcode") {
                                    freshData.yesterdayTotal = freshData.yesterdayTotal ?? cachedData.yesterdayTotal;
                                    freshData.yesterdayDate = freshData.yesterdayDate ?? cachedData.yesterdayDate;
                                }
                                cache[cacheKey] = freshData;
                            }

                            return freshData;
                        } catch (error) {
                            // Return cached data if fetch fails
                            return cachedData || null;
                        }
                    }
                );

                const allStats = await Promise.all(statsPromises);

                const validStats = allStats.filter(
                    (stat): stat is UserStats => stat !== null
                );

                // Save updated cache
                chrome.storage.local.set({ userStatsCache: cache });

                setSquadStats(validStats);
                setLoading(false);
            }
        );
    };

    const handleAddFriend = async () => {
        const username = friendUsername.trim();

        if (!username) {
            showError("Please enter a username");
            return;
        }

        const isValid =
            selectedPlatform === "leetcode"
                ? await verifyLeetCodeUser(username)
                : await verifyCodeforcesUser(username);

        if (!isValid) {
            showError(
                `User "${username}" not found on ${selectedPlatform === "leetcode" ? "LeetCode" : "Codeforces"
                }`
            );
            return;
        }

        chrome.storage.local.get({ friends: [] }, (result) => {
            let friendsList: Friend[] = result.friends;

            // Migrate old format if needed
            if (friendsList.length > 0 && typeof friendsList[0] === "string") {
                friendsList = friendsList.map((f: any) => ({
                    username: f,
                    platform: "leetcode" as Platform,
                }));
            }

            // Check if already exists (in main or merged profiles)
            const alreadyExists = friendsList.some((f) => {
                if (
                    f.username.trim().toLowerCase() ===
                    username.trim().toLowerCase() &&
                    f.platform === selectedPlatform
                ) {
                    return true;
                }
                if (f.mergedWith) {
                    return f.mergedWith.some(
                        (m) =>
                            m.username.trim().toLowerCase() ===
                            username.trim().toLowerCase() &&
                            m.platform === selectedPlatform
                    );
                }
                return false;
            });

            if (alreadyExists) {
                showError(
                    `${username} (${selectedPlatform}) is already in your squad`
                );
                return;
            }

            // Add new friend
            friendsList.push({
                username,
                platform: selectedPlatform,
                id: generateId(username, selectedPlatform),
            });

            // Auto-merge if similar username exists
            friendsList = autoMergeFriends(friendsList);

            chrome.storage.local.set({ friends: friendsList }, () => {
                setFriendUsername("");
                loadSquadRankings();
                showSuccess(`Added ${username} to your squad!`);
            });
        });
    };

    const handleRemoveFriend = (memberId: string) => {
        const member = getDisplayMembers(friends, squadStats).find(
            (m) => m.id === memberId
        );
        if (!member) return;

        const profileNames = member.profiles
            .map((p) => `${p.username} (${p.platform})`)
            .join(", ");

        if (!confirm(`Remove ${profileNames} from your squad?`)) {
            return;
        }

        chrome.storage.local.get({ friends: [] }, (result) => {
            let friendsList: Friend[] = result.friends;

            // Remove the member and all merged profiles
            friendsList = friendsList.filter((f) => {
                if (f.id === memberId) return false;
                if (f.mergedWith) {
                    f.mergedWith = f.mergedWith.filter(
                        (m) => m.id !== memberId
                    );
                }
                return true;
            });

            chrome.storage.local.set({ friends: friendsList }, () => {
                loadSquadRankings();
            });
        });
    };

    const handleSplitMember = (memberId: string) => {
        if (!confirm("Split this merged profile into separate accounts?")) {
            return;
        }

        chrome.storage.local.get({ friends: [] }, (result) => {
            let friendsList: Friend[] = result.friends;

            const memberIdx = friendsList.findIndex((f) => f.id === memberId);
            if (memberIdx === -1) return;

            const member = friendsList[memberIdx];

            // If has merged profiles, split them
            if (member.mergedWith && member.mergedWith.length > 0) {
                // Remove mergedWith array
                const splitProfiles = [
                    { ...member, mergedWith: undefined },
                    ...member.mergedWith.map((m) => ({
                        ...m,
                        mergedWith: undefined,
                    })),
                ];

                // Replace the merged member with split profiles
                friendsList.splice(memberIdx, 1, ...splitProfiles);

                chrome.storage.local.set({ friends: friendsList }, () => {
                    loadSquadRankings();
                    showSuccess("Profiles split successfully!");
                });
            }
        });
    };

    // Edit name handlers
    const handleStartEdit = (memberId: string, currentName: string) => {
        setEditingMemberId(memberId);
        setEditingName(currentName);
    };

    const handleSaveEdit = (memberId: string) => {
        const newName = editingName.trim();

        if (!newName) {
            setEditingMemberId(null);
            return;
        }

        chrome.storage.local.get({ friends: [] }, (result) => {
            let friendsList: Friend[] = result.friends;

            const memberIdx = friendsList.findIndex((f) => f.id === memberId);
            if (memberIdx === -1) return;

            // Update display name
            friendsList[memberIdx].displayName = newName;

            chrome.storage.local.set({ friends: friendsList }, () => {
                setFriends(friendsList);
                setEditingMemberId(null);
                showSuccess("Name updated!");
            });
        });
    };

    const handleCancelEdit = () => {
        setEditingMemberId(null);
        setEditingName("");
    };

    // Focus input when editing starts
    useEffect(() => {
        if (editingMemberId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingMemberId]);

    // Drag and drop handlers
    const handleDragStart = (e: React.DragEvent, memberId: string) => {
        setDragStartPos({ x: e.clientX, y: e.clientY });
        setIsDraggable(false);
        setDraggedMember(memberId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragMove = (e: React.DragEvent) => {
        if (!dragStartPos || isDraggable) return;

        // Check if dragged more than 10 pixels
        const distance = Math.sqrt(
            Math.pow(e.clientX - dragStartPos.x, 2) +
            Math.pow(e.clientY - dragStartPos.y, 2)
        );

        if (distance > 10) {
            setIsDraggable(true);
        }
    };

    const handleDragOver = (e: React.DragEvent, memberId: string) => {
        if (!isDraggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";

        if (memberId !== draggedMember) {
            setDragOverMember(memberId);
        }

        // Auto-scroll logic
        if (scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            const rect = container.getBoundingClientRect();
            const scrollZone = 50;
            const scrollSpeed = 5;

            if (e.clientY - rect.top < scrollZone) {
                // Scroll up
                if (!scrollIntervalRef.current) {
                    scrollIntervalRef.current = window.setInterval(() => {
                        container.scrollTop = Math.max(
                            0,
                            container.scrollTop - scrollSpeed
                        );
                    }, 16);
                }
            } else if (rect.bottom - e.clientY < scrollZone) {
                // Scroll down
                if (!scrollIntervalRef.current) {
                    scrollIntervalRef.current = window.setInterval(() => {
                        container.scrollTop = Math.min(
                            container.scrollHeight - container.clientHeight,
                            container.scrollTop + scrollSpeed
                        );
                    }, 16);
                }
            } else {
                // Stop scrolling
                if (scrollIntervalRef.current) {
                    clearInterval(scrollIntervalRef.current);
                    scrollIntervalRef.current = null;
                }
            }
        }
    };

    const handleDragLeave = () => {
        setDragOverMember(null);
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };

    const handleDrop = (e: React.DragEvent, targetMemberId: string) => {
        e.preventDefault();

        if (!isDraggable) {
            handleDragEnd();
            return;
        }

        if (!draggedMember || draggedMember === targetMemberId) {
            handleDragEnd();
            return;
        }

        // Merge the members
        chrome.storage.local.get({ friends: [] }, (result) => {
            let friendsList: Friend[] = result.friends;

            const draggedIdx = friendsList.findIndex(
                (f) => f.id === draggedMember
            );
            const targetIdx = friendsList.findIndex(
                (f) => f.id === targetMemberId
            );

            if (draggedIdx === -1 || targetIdx === -1) {
                handleDragEnd();
                return;
            }

            const draggedFriend = friendsList[draggedIdx];
            const targetFriend = friendsList[targetIdx];

            // Collect all platforms involved
            const platformCounts: Record<Platform, number> = {
                leetcode: 0,
                codeforces: 0,
            };

            // Count platforms from both members
            platformCounts[draggedFriend.platform]++;
            platformCounts[targetFriend.platform]++;

            draggedFriend.mergedWith?.forEach(
                (m) => platformCounts[m.platform]++
            );
            targetFriend.mergedWith?.forEach(
                (m) => platformCounts[m.platform]++
            );

            // Check if trying to merge same platforms
            if (platformCounts.leetcode > 1 || platformCounts.codeforces > 1) {
                showError(
                    "Can only merge one LeetCode with one Codeforces account"
                );
                handleDragEnd();
                return;
            }

            // Merge dragged into target
            if (!targetFriend.mergedWith) {
                targetFriend.mergedWith = [];
            }

            // Add dragged friend and all its merged profiles
            targetFriend.mergedWith.push(draggedFriend);
            if (draggedFriend.mergedWith) {
                targetFriend.mergedWith.push(...draggedFriend.mergedWith);
            }

            // Remove the dragged friend
            friendsList.splice(draggedIdx, 1);

            chrome.storage.local.set({ friends: friendsList }, () => {
                loadSquadRankings();
                showSuccess(`Merged profiles successfully!`);
            });
        });

        handleDragEnd();
    };

    const handleDragEnd = () => {
        setDraggedMember(null);
        setDragOverMember(null);
        setDragStartPos(null);
        setIsDraggable(false);
        if (scrollIntervalRef.current) {
            clearInterval(scrollIntervalRef.current);
            scrollIntervalRef.current = null;
        }
    };

    const handleViewProfile = (username: string, platform: Platform) => {
        const url =
            platform === "leetcode"
                ? `https://leetcode.com/u/${username}/`
                : `https://codeforces.com/profile/${username}`;
        chrome.tabs.create({ url });
    };

    const showSuccess = (msg: string) => {
        // Simple success notification
        const notification = document.createElement("div");
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
    `;
        notification.textContent = "✓ " + msg;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 2000);
    };

    return (
        <div>
            {/* Add Friend Section */}
            <div style={{ marginBottom: "20px" }}>
                <label
                    style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 600,
                        marginBottom: "8px",
                        color: "var(--text)",
                    }}
                >
                    Add Squad Member
                </label>

                {/* Platform Selector */}
                <div
                    style={{
                        display: "flex",
                        gap: "8px",
                        marginBottom: "10px",
                    }}
                >
                    <button
                        onClick={() => setSelectedPlatform("leetcode")}
                        style={{
                            flex: 1,
                            padding: "8px",
                            background:
                                selectedPlatform === "leetcode"
                                    ? "var(--primary)"
                                    : "var(--bg-secondary)",
                            color:
                                selectedPlatform === "leetcode"
                                    ? "#000"
                                    : "var(--text)",
                            border: `1.5px solid ${selectedPlatform === "leetcode"
                                ? "var(--primary)"
                                : "var(--border)"
                                }`,
                            borderRadius: "var(--radius)",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "13px",
                        }}
                    >
                        LeetCode
                    </button>
                    <button
                        onClick={() => setSelectedPlatform("codeforces")}
                        style={{
                            flex: 1,
                            padding: "8px",
                            background:
                                selectedPlatform === "codeforces"
                                    ? "var(--primary)"
                                    : "var(--bg-secondary)",
                            color:
                                selectedPlatform === "codeforces"
                                    ? "#000"
                                    : "var(--text)",
                            border: `1.5px solid ${selectedPlatform === "codeforces"
                                ? "var(--primary)"
                                : "var(--border)"
                                }`,
                            borderRadius: "var(--radius)",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "13px",
                        }}
                    >
                        Codeforces
                    </button>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                    <input
                        type="text"
                        value={friendUsername}
                        onChange={(e) => setFriendUsername(e.target.value)}
                        onKeyPress={(e) =>
                            e.key === "Enter" && handleAddFriend()
                        }
                        placeholder={`${selectedPlatform === "leetcode"
                            ? "LeetCode"
                            : "Codeforces"
                            } username`}
                        style={{
                            flex: 1,
                            padding: "12px 14px",
                            border: "1.5px solid var(--border)",
                            borderRadius: "var(--radius)",
                            fontSize: "14px",
                            background: "var(--bg-secondary)",
                            color: "var(--text)",
                        }}
                    />
                    <button
                        onClick={handleAddFriend}
                        style={{
                            width: "48px",
                            background: "var(--secondary)",
                            color: "white",
                            fontSize: "20px",
                            padding: "12px",
                            borderRadius: "var(--radius)",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        +
                    </button>
                </div>
                <small
                    style={{
                        display: "block",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginTop: "6px",
                    }}
                >
                    Select platform and add friends to track their progress
                </small>
            </div>

            {/* Squad Rankings */}
            <h3
                style={{
                    fontSize: "16px",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <div style={{ display: "flex", alignItems: "center" }}>
                    Squad Rankings
                    <span
                        style={{
                            background: "var(--primary)",
                            color: "#000",
                            fontSize: "11px",
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: "16px",
                            marginLeft: "8px",
                        }}
                    >
                        {friends.length}
                    </span>
                </div>
                <button
                    onClick={() => loadSquadRankings(true)}
                    disabled={loading}
                    style={{
                        background: "var(--primary)",
                        color: "#000",
                        border: "none",
                        borderRadius: "var(--radius-sm)",
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.6 : 1,
                        transition: "all 0.2s",
                    }}
                    title="Refresh rankings"
                >
                    {loading ? "⟳" : "↻"}
                </button>
            </h3>

            <div
                ref={scrollContainerRef}
                style={{
                    maxHeight: "600px",
                    overflowY: "auto",
                    paddingRight: "4px",
                }}
                className="squad-list-container"
            >
                <style>{`
                    .squad-list-container::-webkit-scrollbar {
                        width: 8px;
                    }
                    .squad-list-container::-webkit-scrollbar-track {
                        background: var(--bg-secondary);
                        border-radius: 4px;
                    }
                    .squad-list-container::-webkit-scrollbar-thumb {
                        background: var(--border);
                        border-radius: 4px;
                        transition: background 0.2s;
                    }
                    .squad-list-container::-webkit-scrollbar-thumb:hover {
                        background: var(--primary);
                    }
                    .dragging {
                        opacity: 0.5;
                        cursor: grabbing !important;
                    }
                    .drag-over {
                        border: 2px dashed var(--primary) !important;
                        background: var(--bg-tertiary) !important;
                    }
                `}</style>
                {friends.length === 0 && (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "40px 20px",
                            color: "var(--text-secondary)",
                        }}
                    >
                        <p style={{ fontSize: "16px", marginBottom: "8px" }}>
                            👥 No squad members yet
                        </p>
                        <small style={{ fontSize: "13px" }}>
                            Add friends to see their rankings
                        </small>
                    </div>
                )}

                {getDisplayMembers(friends, squadStats).map((member, index) => {
                    const medal =
                        index === 0
                            ? "🥇"
                            : index === 1
                                ? "🥈"
                                : index === 2
                                    ? "🥉"
                                    : `#${index + 1}`;
                    const rankColor =
                        index === 0
                            ? "#ffd700"
                            : index === 1
                                ? "#c0c0c0"
                                : index === 2
                                    ? "#cd7f32"
                                    : "var(--text)";

                    const totalProblems = member.stats.reduce(
                        (sum, s) => sum + s.total,
                        0
                    );
                    const isMerged = member.profiles.length > 1;
                    const isDragging = draggedMember === member.id;
                    const isDragOver =
                        dragOverMember === member.id && isDraggable;

                    // Get platforms
                    const hasLeetCode = member.profiles.some(
                        (p) => p.platform === "leetcode"
                    );
                    const hasCodeforces = member.profiles.some(
                        (p) => p.platform === "codeforces"
                    );

                    // Get stats by platform
                    const lcStats = member.stats.find(
                        (s) => s.platform === "leetcode"
                    );
                    const cfStats = member.stats.find(
                        (s) => s.platform === "codeforces"
                    );

                    return (
                        <div
                            key={member.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, member.id)}
                            onDrag={handleDragMove}
                            onDragOver={(e) => handleDragOver(e, member.id)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, member.id)}
                            onDragEnd={handleDragEnd}
                            className={`${isDragging ? "dragging" : ""} ${isDragOver ? "drag-over" : ""
                                }`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "14px",
                                background: "var(--bg-secondary)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius)",
                                marginBottom: "10px",
                                transition: "all 0.2s",
                                cursor: "grab",
                                position: "relative",
                            }}
                            onMouseEnter={(e) => {
                                if (!isDragging) {
                                    e.currentTarget.style.background =
                                        "var(--bg-tertiary)";
                                    e.currentTarget.style.borderColor =
                                        "var(--primary)";
                                    e.currentTarget.style.transform =
                                        "translateY(-2px)";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isDragging) {
                                    e.currentTarget.style.background =
                                        "var(--bg-secondary)";
                                    e.currentTarget.style.borderColor =
                                        "var(--border)";
                                    e.currentTarget.style.transform =
                                        "translateY(0)";
                                }
                            }}
                        >
                            <div
                                style={{
                                    fontSize: "18px",
                                    fontWeight: 700,
                                    width: "40px",
                                    textAlign: "center",
                                    color: rankColor,
                                }}
                            >
                                {medal}
                            </div>
                            <div
                                style={{
                                    width: "36px",
                                    height: "36px",
                                    borderRadius: "50%",
                                    background:
                                        "linear-gradient(135deg, var(--primary), var(--secondary))",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "white",
                                    fontWeight: 600,
                                    fontSize: "14px",
                                    marginLeft: "12px",
                                }}
                            >
                                {member.mainUsername[0].toUpperCase()}
                            </div>
                            <div style={{ flex: 1, marginLeft: "12px" }}>
                                <div
                                    style={{
                                        fontWeight: 600,
                                        fontSize: "14px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {editingMemberId === member.id ? (
                                        <input
                                            ref={editInputRef}
                                            type="text"
                                            value={editingName}
                                            onChange={(e) =>
                                                setEditingName(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    handleSaveEdit(member.id);
                                                } else if (e.key === "Escape") {
                                                    handleCancelEdit();
                                                }
                                            }}
                                            onBlur={() =>
                                                handleSaveEdit(member.id)
                                            }
                                            style={{
                                                padding: "4px 8px",
                                                border: "2px solid var(--primary)",
                                                borderRadius: "4px",
                                                fontSize: "14px",
                                                fontWeight: 600,
                                                background:
                                                    "var(--bg-secondary)",
                                                color: "var(--text)",
                                                outline: "none",
                                                minWidth: "120px",
                                            }}
                                        />
                                    ) : (
                                        <span
                                            onDoubleClick={() =>
                                                handleStartEdit(
                                                    member.id,
                                                    member.mainUsername
                                                )
                                            }
                                            style={{
                                                cursor: "text",
                                                padding: "2px 4px",
                                                borderRadius: "4px",
                                                transition: "background 0.2s",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background =
                                                    "rgba(255,255,255,0.1)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background =
                                                    "transparent";
                                            }}
                                            title="Double-click to edit name"
                                        >
                                            {member.mainUsername}
                                        </span>
                                    )}
                                    {hasLeetCode && (
                                        <span
                                            onClick={() => {
                                                const lcProfile =
                                                    member.profiles.find(
                                                        (p) =>
                                                            p.platform ===
                                                            "leetcode"
                                                    );
                                                if (lcProfile)
                                                    handleViewProfile(
                                                        lcProfile.username,
                                                        "leetcode"
                                                    );
                                            }}
                                            style={{
                                                background: "#FFA116",
                                                color: "white",
                                                fontSize: "9px",
                                                fontWeight: 700,
                                                padding: "2px 6px",
                                                borderRadius: "4px",
                                                textTransform: "uppercase",
                                                cursor: "pointer",
                                                transition: "opacity 0.2s",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.opacity =
                                                    "0.8";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.opacity =
                                                    "1";
                                            }}
                                            title="View LeetCode profile"
                                        >
                                            LC
                                        </span>
                                    )}
                                    {hasCodeforces && (
                                        <span
                                            onClick={() => {
                                                const cfProfile =
                                                    member.profiles.find(
                                                        (p) =>
                                                            p.platform ===
                                                            "codeforces"
                                                    );
                                                if (cfProfile)
                                                    handleViewProfile(
                                                        cfProfile.username,
                                                        "codeforces"
                                                    );
                                            }}
                                            style={{
                                                background: "#1F8ACB",
                                                color: "white",
                                                fontSize: "9px",
                                                fontWeight: 700,
                                                padding: "2px 6px",
                                                borderRadius: "4px",
                                                textTransform: "uppercase",
                                                cursor: "pointer",
                                                transition: "opacity 0.2s",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.opacity =
                                                    "0.8";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.opacity =
                                                    "1";
                                            }}
                                            title="View Codeforces profile"
                                        >
                                            CF
                                        </span>
                                    )}
                                </div>
                                <div
                                    style={{
                                        fontSize: "12px",
                                        color: "var(--text-secondary)",
                                        marginTop: "4px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        flexWrap: "wrap",
                                    }}
                                >
                                    {lcStats?.solvedToday && (
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                background:
                                                    "rgba(44, 187, 93, 0.15)",
                                                color: "#2CBB5D",
                                            }}
                                        >
                                            ✓ LC
                                            {lcStats.todayCount &&
                                                lcStats.todayCount > 1 && (
                                                    <span
                                                        style={{
                                                            background:
                                                                "#2CBB5D",
                                                            color: "white",
                                                            padding: "1px 5px",
                                                            borderRadius: "8px",
                                                            fontSize: "10px",
                                                        }}
                                                    >
                                                        {lcStats.todayCount}
                                                    </span>
                                                )}
                                        </span>
                                    )}
                                    {cfStats?.solvedToday && (
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                alignItems: "center",
                                                gap: "4px",
                                                padding: "2px 8px",
                                                borderRadius: "12px",
                                                fontSize: "11px",
                                                fontWeight: 600,
                                                background:
                                                    "rgba(44, 187, 93, 0.15)",
                                                color: "#2CBB5D",
                                            }}
                                        >
                                            ✓ CF
                                            {cfStats.todayCount &&
                                                cfStats.todayCount > 1 && (
                                                    <span
                                                        style={{
                                                            background:
                                                                "#2CBB5D",
                                                            color: "white",
                                                            padding: "1px 5px",
                                                            borderRadius: "8px",
                                                            fontSize: "10px",
                                                        }}
                                                    >
                                                        {cfStats.todayCount}
                                                    </span>
                                                )}
                                        </span>
                                    )}
                                    {cfStats?.rating && (
                                        <span
                                            style={{
                                                color: getCodeforcesRankColor(
                                                    cfStats.rating
                                                ),
                                                fontSize: "11px",
                                                fontWeight: 600,
                                            }}
                                        >
                                            CF: {cfStats.rating}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div
                                style={{
                                    fontSize: "16px",
                                    fontWeight: 600,
                                    color: "var(--primary)",
                                    marginRight: "8px",
                                }}
                            >
                                {totalProblems}
                            </div>
                            {isMerged ? (
                                <button
                                    onClick={() => handleSplitMember(member.id)}
                                    style={{
                                        background: "var(--primary)",
                                        color: "#000",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "6px 10px",
                                        borderRadius: "var(--radius-sm)",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        transition: "all 0.2s",
                                        marginLeft: "8px",
                                    }}
                                    title="Split into separate accounts"
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.opacity = "0.8";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.opacity = "1";
                                    }}
                                >
                                    Split
                                </button>
                            ) : (
                                <button
                                    onClick={() =>
                                        handleRemoveFriend(member.id)
                                    }
                                    style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        padding: "8px",
                                        borderRadius: "var(--radius-sm)",
                                        fontSize: "16px",
                                        color: "var(--error)",
                                        transition: "all 0.2s",
                                        marginLeft: "8px",
                                    }}
                                    title="Remove"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SquadTab;
