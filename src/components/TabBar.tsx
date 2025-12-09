import React from "react";

interface TabBarProps {
    activeTab: "search" | "squad";
    onTabChange: (tab: "search" | "squad") => void;
}

const TabBar: React.FC<TabBarProps> = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: "search" as const, label: "🔍 Search" },
        { id: "squad" as const, label: "👥 Squad" },
    ];

    return (
        <div
            style={{
                display: "flex",
                background: "var(--bg-secondary)",
                borderBottom: "1px solid var(--border)",
                position: "relative",
            }}
        >
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        flex: 1,
                        padding: "12px 8px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: activeTab === tab.id ? 600 : 500,
                        color:
                            activeTab === tab.id
                                ? "var(--primary)"
                                : "var(--text-secondary)",
                        transition: "color 0.2s, background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                        if (activeTab !== tab.id) {
                            e.currentTarget.style.background =
                                "var(--bg-tertiary)";
                            e.currentTarget.style.color = "var(--text)";
                        }
                    }}
                    onMouseLeave={(e) => {
                        if (activeTab !== tab.id) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color =
                                "var(--text-secondary)";
                        }
                    }}
                >
                    {tab.label}
                </button>
            ))}
            <div
                style={{
                    position: "absolute",
                    bottom: "-1px",
                    left: activeTab === "search" ? "0%" : "50%",
                    height: "3px",
                    background: "var(--primary)",
                    borderRadius: "var(--radius) var(--radius) 0 0",
                    transition: "left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    width: "50%",
                }}
            />
        </div>
    );
};

export default TabBar;
