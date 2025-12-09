import React, { useState, useEffect } from "react";
import { getUserStats, verifyLeetCodeUser } from "../utils/leetcode-api";
import type { UserStats } from "../types";

interface SquadTabProps {
    showError: (msg: string) => void;
}

const SquadTab: React.FC<SquadTabProps> = ({ showError }) => {
    const [friendUsername, setFriendUsername] = useState("");
    const [friends, setFriends] = useState<string[]>([]);
    const [squadStats, setSquadStats] = useState<UserStats[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadSquadRankings();
    }, []);

    const loadSquadRankings = async () => {
        setLoading(true);
        chrome.storage.local.get({ friends: [] }, async (result) => {
            const friendsList = result.friends;
            setFriends(friendsList);

            if (friendsList.length === 0) {
                setSquadStats([]);
                setLoading(false);
                return;
            }

            const statsPromises = friendsList.map((friend: string) =>
                getUserStats(friend)
            );
            const allStats = await Promise.all(statsPromises);

            const validStats = allStats
                .filter((stat): stat is UserStats => stat !== null)
                .sort((a, b) => b.total - a.total);

            setSquadStats(validStats);
            setLoading(false);
        });
    };

    const handleAddFriend = async () => {
        const username = friendUsername.trim();

        if (!username) {
            showError("Please enter a username");
            return;
        }

        const isValid = await verifyLeetCodeUser(username);

        if (!isValid) {
            showError(`User "${username}" not found on LeetCode`);
            return;
        }

        chrome.storage.local.get({ friends: [] }, (result) => {
            const friendsList = result.friends;

            if (friendsList.includes(username)) {
                showError(`${username} is already in your squad`);
                return;
            }

            friendsList.push(username);
            chrome.storage.local.set({ friends: friendsList }, () => {
                setFriendUsername("");
                loadSquadRankings();
                showSuccess(`Added ${username} to your squad!`);
            });
        });
    };

    const handleRemoveFriend = (username: string) => {
        if (!confirm(`Remove ${username} from your squad?`)) {
            return;
        }

        chrome.storage.local.get({ friends: [] }, (result) => {
            const friendsList = result.friends.filter(
                (f: string) => f !== username
            );
            chrome.storage.local.set({ friends: friendsList }, () => {
                loadSquadRankings();
            });
        });
    };

    const handleViewProfile = (username: string) => {
        const url = `https://leetcode.com/u/${username}/`;
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
                <div style={{ display: "flex", gap: "10px" }}>
                    <input
                        type="text"
                        value={friendUsername}
                        onChange={(e) => setFriendUsername(e.target.value)}
                        onKeyPress={(e) =>
                            e.key === "Enter" && handleAddFriend()
                        }
                        placeholder="LeetCode username"
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
            </div>

            {/* Squad Rankings */}
            <h3
                style={{
                    fontSize: "16px",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                }}
            >
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
            </h3>

            <div style={{ maxHeight: "350px", overflowY: "auto" }}>
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
                                key={user.username}
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
                                        }}
                                    >
                                        {user.username}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "12px",
                                            color: "var(--text-secondary)",
                                            marginTop: "2px",
                                        }}
                                    >
                                        <span style={{ color: "#2CBB5D" }}>
                                            {user.easy}E
                                        </span>{" "}
                                        ·{" "}
                                        <span style={{ color: "#FFA116" }}>
                                            {user.medium}M
                                        </span>{" "}
                                        ·{" "}
                                        <span style={{ color: "#EF4743" }}>
                                            {user.hard}H
                                        </span>
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
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "6px",
                                        marginLeft: "12px",
                                    }}
                                >
                                    <button
                                        onClick={() =>
                                            handleViewProfile(user.username)
                                        }
                                        style={{
                                            background: "none",
                                            border: "none",
                                            cursor: "pointer",
                                            padding: "8px",
                                            borderRadius: "var(--radius-sm)",
                                            fontSize: "16px",
                                            color: "var(--primary)",
                                            transition: "all 0.2s",
                                        }}
                                        title="View Profile"
                                    >
                                        🔗
                                    </button>
                                    <button
                                        onClick={() =>
                                            handleRemoveFriend(user.username)
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
                                        }}
                                        title="Remove"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </div>
    );
};

export default SquadTab;
