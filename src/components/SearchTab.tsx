import React, { useState } from "react";
import type { SearchRequest, SearchResponse } from "../types";

interface SearchTabProps {
    showError: (msg: string) => void;
    clearError: () => void;
}

const SearchTab: React.FC<SearchTabProps> = ({ showError, clearError }) => {
    const [usernames, setUsernames] = useState("");
    const [startRank, setStartRank] = useState("1");
    const [endRank, setEndRank] = useState("");

    const handleStartSearch = () => {
        clearError();

        const usernamesTrimmed = usernames.trim();
        const startRankNum = startRank ? parseInt(startRank, 10) : 1;
        const endRankNum = endRank ? parseInt(endRank, 10) : undefined;

        if (!usernamesTrimmed) {
            return showError("Please enter at least one username.");
        }
        if (startRankNum < 1) {
            return showError("Start rank must be at least 1.");
        }
        if (endRankNum && endRankNum < startRankNum) {
            return showError("End rank must be >= start rank.");
        }

        // Convert ranks to pages (25 per page)
        const rankToPage = (rank: number) => Math.floor((rank - 1) / 25) + 1;
        const startPage = rankToPage(startRankNum);
        const endPage = endRankNum ? rankToPage(endRankNum) : undefined;

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTab = tabs[0];

            if (
                !currentTab.url ||
                !currentTab.url.includes("leetcode.com/contest/") ||
                !currentTab.url.includes("/ranking/")
            ) {
                showError(
                    "Please open a LeetCode contest ranking page first.\\nExample: https://leetcode.com/contest/weekly-contest-XXX/ranking/1/"
                );
                return;
            }

            const message: SearchRequest = {
                action: "startSearch",
                startPage,
                endPage,
                startRank: startRankNum,
                endRank: endRankNum,
                usernames: usernamesTrimmed,
                pageSize: 25,
            };

            chrome.tabs.sendMessage(
                currentTab.id!,
                message,
                (response: SearchResponse) => {
                    if (chrome.runtime.lastError) {
                        showError(
                            "Cannot connect to page. Please refresh the contest ranking page and try again."
                        );
                        return;
                    }

                    if (response && response.status === "started") {
                        window.close();
                    } else if (response && response.status === "error") {
                        if (
                            response.message === "Not on a contest ranking page"
                        ) {
                            showError(
                                "Please open a LeetCode contest ranking page first."
                            );
                        } else {
                            showError("Error: " + response.message);
                        }
                    } else {
                        showError(
                            "Failed to start. Please refresh the page and try again."
                        );
                    }
                }
            );
        });
    };

    return (
        <div>
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
                    Usernames
                </label>
                <textarea
                    value={usernames}
                    onChange={(e) => setUsernames(e.target.value)}
                    placeholder="Enter usernames separated by commas"
                    style={{
                        width: "100%",
                        padding: "12px 14px",
                        border: "1.5px solid var(--border)",
                        borderRadius: "var(--radius)",
                        fontSize: "14px",
                        fontFamily: "inherit",
                        background: "var(--bg-secondary)",
                        color: "var(--text)",
                        resize: "vertical",
                        minHeight: "60px",
                    }}
                />
                <small
                    style={{
                        display: "block",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginTop: "6px",
                    }}
                >
                    e.g., user1, user2, user3
                </small>
            </div>

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
                    Rank Range
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                    <input
                        type="number"
                        value={startRank}
                        onChange={(e) => setStartRank(e.target.value)}
                        min="1"
                        placeholder="Start"
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
                    <input
                        type="number"
                        value={endRank}
                        onChange={(e) => setEndRank(e.target.value)}
                        min="1"
                        placeholder="End (optional)"
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
                </div>
                <small
                    style={{
                        display: "block",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginTop: "6px",
                    }}
                >
                    Leave end blank for open-ended search
                </small>
            </div>

            <button
                onClick={handleStartSearch}
                style={{
                    padding: "12px 20px",
                    border: "none",
                    borderRadius: "var(--radius)",
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    width: "100%",
                    background: "var(--primary)",
                    color: "white",
                    boxShadow: "var(--shadow)",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--primary-hover)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = "var(--primary)";
                    e.currentTarget.style.transform = "translateY(0)";
                }}
            >
                🚀 Start Search
            </button>
        </div>
    );
};

export default SearchTab;
