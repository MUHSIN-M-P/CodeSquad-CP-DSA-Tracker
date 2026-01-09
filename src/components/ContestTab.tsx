import React, { useState, useEffect } from "react";

interface Contest {
    title: string;
    startTime: number;
    duration: number;
    platform: "leetcode" | "codeforces";
}

interface ContestTabProps {
    showError: (msg: string) => void;
}

const ContestTab: React.FC<ContestTabProps> = ({ showError }) => {
    const [contests, setContests] = useState<Contest[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        fetchContests();
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchContests = async () => {
        try {
            // Fetch LeetCode contests
            const leetcodePromise = fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: `
                        query allContests {
                            allContests {
                                title
                                startTime
                                duration
                            }
                        }
                    `,
                }),
            })
                .then((res) => res.json())
                .then((data) =>
                    data.data.allContests
                        .filter((c: any) => c.startTime * 1000 > Date.now())
                        .map((c: any) => ({
                            ...c,
                            platform: "leetcode" as const,
                        }))
                )
                .catch(() => []);

            // Fetch Codeforces contests
            const codeforcesPromise = fetch(
                "https://codeforces.com/api/contest.list"
            )
                .then((res) => res.json())
                .then((data) => {
                    if (data.status === "OK") {
                        return data.result
                            .filter(
                                (c: any) =>
                                    c.phase === "BEFORE" &&
                                    c.startTimeSeconds * 1000 > Date.now()
                            )
                            .map((c: any) => ({
                                title: c.name,
                                startTime: c.startTimeSeconds,
                                duration: c.durationSeconds,
                                platform: "codeforces" as const,
                            }));
                    }
                    return [];
                })
                .catch(() => []);

            const [leetcodeContests, codeforcesContests] = await Promise.all([
                leetcodePromise,
                codeforcesPromise,
            ]);

            // Filter contests within 1 week (7 days)
            const oneWeekFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
            const allContests = [...leetcodeContests, ...codeforcesContests]
                .filter((c) => c.startTime * 1000 <= oneWeekFromNow)
                .sort((a, b) => a.startTime - b.startTime)
                .slice(0, 8);

            setContests(allContests);
        } catch (err) {
            showError("Failed to fetch contests");
        } finally {
            setLoading(false);
        }
    };

    const formatCountdown = (timestamp: number) => {
        const diff = timestamp * 1000 - now;
        if (diff <= 0) return "Started";

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m ${seconds}s`;
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getPlatformIcon = (platform: "leetcode" | "codeforces") => {
        return platform === "leetcode" ? "💻" : "🎯";
    };

    const getPlatformColor = (platform: "leetcode" | "codeforces") => {
        return platform === "leetcode" ? "#FFA116" : "#1F8ACB";
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                    Loading contests...
                </div>
            </div>
        );
    }

    if (contests.length === 0) {
        return (
            <div style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                    No upcoming contests
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* Problem of the Day Section */}
            <div style={{ marginBottom: 24 }}>
                <h3
                    style={{
                        fontSize: 16,
                        fontWeight: 600,
                        marginBottom: 12,
                        color: "var(--text)",
                    }}
                >
                    📝 Problem of the Day
                </h3>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                    }}
                >
                    <a
                        href="https://leetcode.com/problemset/"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            textDecoration: "none",
                            color: "var(--text)",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                                "var(--bg-tertiary)";
                            e.currentTarget.style.borderColor = "#FFA116";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                                "var(--bg-secondary)";
                            e.currentTarget.style.borderColor = "var(--border)";
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    background: "#FFA116",
                                    color: "white",
                                }}
                            >
                                💻 LEETCODE
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                                Daily Challenge
                            </span>
                        </div>
                        <span style={{ fontSize: 18 }}>→</span>
                    </a>

                    <a
                        href="https://www.geeksforgeeks.org/problem-of-the-day"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 14px",
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border)",
                            borderRadius: 8,
                            textDecoration: "none",
                            color: "var(--text)",
                            transition: "all 0.2s",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background =
                                "var(--bg-tertiary)";
                            e.currentTarget.style.borderColor = "#2F8D46";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background =
                                "var(--bg-secondary)";
                            e.currentTarget.style.borderColor = "var(--border)";
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "4px 8px",
                                    borderRadius: 4,
                                    background: "#2F8D46",
                                    color: "white",
                                }}
                            >
                                📚 GFG
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>
                                Problem of the Day
                            </span>
                        </div>
                        <span style={{ fontSize: 18 }}>→</span>
                    </a>
                </div>
            </div>

            <h3
                style={{
                    fontSize: 16,
                    fontWeight: 600,
                    marginBottom: 16,
                    color: "var(--text)",
                }}
            >
                🏆 Upcoming Contests (Next 7 Days)
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {contests.map((contest, idx) => {
                    const isPrimary = idx === 0;
                    const platformColor = getPlatformColor(contest.platform);
                    return (
                        <div
                            key={contest.title}
                            style={{
                                background: isPrimary
                                    ? "var(--bg-tertiary)"
                                    : "var(--bg-secondary)",
                                border: isPrimary
                                    ? "2px solid var(--primary)"
                                    : "1px solid var(--border)",
                                borderRadius: 10,
                                padding: "14px 16px",
                                position: "relative",
                                overflow: "hidden",
                            }}
                        >
                            {isPrimary && (
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        right: 8,
                                        background: "var(--primary)",
                                        color: "white",
                                        fontSize: 10,
                                        fontWeight: 600,
                                        padding: "3px 8px",
                                        borderRadius: 4,
                                        textTransform: "uppercase",
                                    }}
                                >
                                    Next
                                </div>
                            )}

                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: 8,
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        padding: "2px 6px",
                                        borderRadius: 4,
                                        background: platformColor,
                                        color: "white",
                                        textTransform: "uppercase",
                                    }}
                                >
                                    {getPlatformIcon(contest.platform)}{" "}
                                    {contest.platform}
                                </span>
                            </div>

                            <div
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: "var(--text)",
                                    marginBottom: 8,
                                    paddingRight: isPrimary ? 60 : 0,
                                }}
                            >
                                {contest.title}
                            </div>

                            <div
                                style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    fontSize: 12,
                                }}
                            >
                                <div style={{ color: "var(--text-secondary)" }}>
                                    📅 {formatDate(contest.startTime)}
                                </div>
                                <div
                                    style={{
                                        color: isPrimary
                                            ? "var(--primary)"
                                            : "var(--text)",
                                        fontWeight: 600,
                                        fontFamily: "monospace",
                                    }}
                                >
                                    ⏱ {formatCountdown(contest.startTime)}
                                </div>
                            </div>

                            <div
                                style={{
                                    fontSize: 11,
                                    color: "var(--text-secondary)",
                                    marginTop: 6,
                                }}
                            >
                                Duration: {Math.round(contest.duration / 60)}{" "}
                                minutes
                            </div>
                        </div>
                    );
                })}
            </div>

            <div
                style={{
                    marginTop: 16,
                    padding: 12,
                    background: "var(--bg-secondary)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    textAlign: "center",
                }}
            >
                💡 Tip: Showing contests within next 7 days only
            </div>
        </div>
    );
};

export default ContestTab;
