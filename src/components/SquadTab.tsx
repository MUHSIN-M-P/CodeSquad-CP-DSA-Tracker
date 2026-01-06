import React, { useState, useEffect } from "react";
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

const SquadTab: React.FC<SquadTabProps> = ({ showError }) => {
    const [friendUsername, setFriendUsername] = useState("");
    const [selectedPlatform, setSelectedPlatform] =
        useState<Platform>("leetcode");
    const [friends, setFriends] = useState<Friend[]>([]);
    const [squadStats, setSquadStats] = useState<UserStats[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSquadRankings();
    }, []);

    const loadSquadRankings = async () => {
        setLoading(true);
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
                    chrome.storage.local.set({ friends: friendsList });
                }

                setFriends(friendsList);

                if (friendsList.length === 0) {
                    setSquadStats([]);
                    setLoading(false);
                    return;
                }

                const now = Date.now();
                const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

                const statsPromises = friendsList.map(
                    async (friend: Friend) => {
                        const cacheKey = `${friend.username}-${friend.platform}`;
                        const cachedData = cache[cacheKey];

                        // Use cache if fresh and data hasn't changed
                        if (
                            cachedData &&
                            cachedData.cachedAt &&
                            now - cachedData.cachedAt < CACHE_DURATION
                        ) {
                            return cachedData;
                        }

                        // Fetch fresh data
                        const freshData =
                            friend.platform === "leetcode"
                                ? await getUserStats(friend.username)
                                : await getCodeforcesUserStats(friend.username);

                        if (freshData) {
                            freshData.cachedAt = now;
                            freshData.lastFetched = now;
                            cache[cacheKey] = freshData;
                        }

                        return freshData;
                    }
                );

                const allStats = await Promise.all(statsPromises);

                const validStats = allStats
                    .filter((stat): stat is UserStats => stat !== null)
                    .sort((a, b) => b.total - a.total);

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
                `User "${username}" not found on ${
                    selectedPlatform === "leetcode" ? "LeetCode" : "Codeforces"
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

            if (
                friendsList.some(
                    (f) =>
                        f.username === username &&
                        f.platform === selectedPlatform
                )
            ) {
                showError(
                    `${username} (${selectedPlatform}) is already in your squad`
                );
                return;
            }

            friendsList.push({ username, platform: selectedPlatform });
            chrome.storage.local.set({ friends: friendsList }, () => {
                setFriendUsername("");
                loadSquadRankings();
                showSuccess(`Added ${username} to your squad!`);
            });
        });
    };

    const handleRemoveFriend = (username: string, platform: Platform) => {
        if (!confirm(`Remove ${username} (${platform}) from your squad?`)) {
            return;
        }

        chrome.storage.local.get({ friends: [] }, (result) => {
            const friendsList: Friend[] = result.friends.filter(
                (f: Friend) =>
                    !(f.username === username && f.platform === platform)
            );
            chrome.storage.local.set({ friends: friendsList }, () => {
                loadSquadRankings();
            });
        });
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
                            border: `1.5px solid ${
                                selectedPlatform === "leetcode"
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
                            border: `1.5px solid ${
                                selectedPlatform === "codeforces"
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
                        placeholder={`${
                            selectedPlatform === "leetcode"
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
                    onClick={loadSquadRankings}
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
                `}</style>
                {loading && (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "40px 20px",
                            color: "var(--text-secondary)",
                        }}
                    >
                        <p style={{ fontSize: "16px", marginBottom: "8px" }}>
                            ⏳ Loading rankings...
                        </p>
                    </div>
                )}

                {!loading && squadStats.length === 0 && (
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

                {!loading &&
                    squadStats.map((user, index) => {
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

                        return (
                            <div
                                key={`${user.username}-${user.platform}`}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "14px",
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius)",
                                    marginBottom: "10px",
                                    transition: "all 0.2s",
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background =
                                        "var(--bg-tertiary)";
                                    e.currentTarget.style.borderColor =
                                        "var(--primary)";
                                    e.currentTarget.style.transform =
                                        "translateY(-2px)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background =
                                        "var(--bg-secondary)";
                                    e.currentTarget.style.borderColor =
                                        "var(--border)";
                                    e.currentTarget.style.transform =
                                        "translateY(0)";
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
                                    {user.username[0].toUpperCase()}
                                </div>
                                <div style={{ flex: 1, marginLeft: "12px" }}>
                                    <div
                                        style={{
                                            fontWeight: 600,
                                            fontSize: "14px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "6px",
                                        }}
                                    >
                                        <span
                                            onClick={() =>
                                                handleViewProfile(
                                                    user.username,
                                                    user.platform
                                                )
                                            }
                                            style={{
                                                cursor: "pointer",
                                                transition: "color 0.2s",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.color =
                                                    "var(--primary)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.color =
                                                    "var(--text)";
                                            }}
                                        >
                                            {user.username}
                                        </span>
                                        <span
                                            style={{
                                                background:
                                                    user.platform === "leetcode"
                                                        ? "#FFA116"
                                                        : "#1F8ACB",
                                                color: "white",
                                                fontSize: "9px",
                                                fontWeight: 700,
                                                padding: "2px 6px",
                                                borderRadius: "4px",
                                                textTransform: "uppercase",
                                            }}
                                        >
                                            {user.platform === "leetcode"
                                                ? "LC"
                                                : "CF"}
                                        </span>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--text-secondary)",
                                            marginTop: "2px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                        }}
                                    >
                                        {user.solvedToday && (
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
                                                ✓ Active today
                                                {user.todayCount &&
                                                    user.todayCount > 1 && (
                                                        <span
                                                            style={{
                                                                background:
                                                                    "#2CBB5D",
                                                                color: "white",
                                                                padding:
                                                                    "1px 5px",
                                                                borderRadius:
                                                                    "8px",
                                                                fontSize:
                                                                    "10px",
                                                            }}
                                                        >
                                                            {user.todayCount}
                                                        </span>
                                                    )}
                                            </span>
                                        )}
                                        {user.platform === "codeforces" &&
                                            user.rating && (
                                                <span
                                                    style={{
                                                        color: getCodeforcesRankColor(
                                                            user.rating
                                                        ),
                                                        fontSize: "11px",
                                                    }}
                                                >
                                                    {user.rating}
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
                                    {user.total}
                                </div>
                                <button
                                    onClick={() =>
                                        handleRemoveFriend(
                                            user.username,
                                            user.platform
                                        )
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
                                        marginLeft: "12px",
                                    }}
                                    title="Remove"
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};

export default SquadTab;
