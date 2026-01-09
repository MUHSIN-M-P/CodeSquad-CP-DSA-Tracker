import React, { useEffect, useState } from "react";

const Header: React.FC = () => {
    const [theme, setTheme] = useState<"light" | "dark">("light");

    useEffect(() => {
        const saved = localStorage.getItem("theme") as "light" | "dark" | null;
        if (saved) {
            setTheme(saved);
            if (saved === "dark") {
                document.documentElement.classList.add("theme-dark");
            } else {
                document.documentElement.classList.remove("theme-dark");
            }
        } else {
            const prefersDark =
                window.matchMedia &&
                window.matchMedia("(prefers-color-scheme: dark)").matches;
            const initial = prefersDark ? "dark" : "light";
            setTheme(initial);
            if (initial === "dark") {
                document.documentElement.classList.add("theme-dark");
            } else {
                document.documentElement.classList.remove("theme-dark");
            }
        }
    }, []);

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        if (next === "dark") {
            document.documentElement.classList.add("theme-dark");
        } else {
            document.documentElement.classList.remove("theme-dark");
        }
        localStorage.setItem("theme", next);
    };

    return (
        <div
            style={{
                background: "var(--bg-header)",
                borderBottom: "1px solid var(--border)",
                color: "var(--text)",
                padding: "20px 20px",
                textAlign: "center",
                position: "relative",
            }}
        >
            <button
                onClick={toggleTheme}
                title={
                    theme === "dark"
                        ? "Switch to light theme"
                        : "Switch to dark theme"
                }
                aria-label="Toggle theme"
                style={{
                    position: "absolute",
                    right: 12,
                    top: 12,
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                    padding: "6px 8px",
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 14,
                }}
            >
                {theme === "dark" ? "☀️" : "🌙"}
            </button>

            <h1
                style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    marginBottom: "4px",
                }}
            >
                CodeSquad Tracker
            </h1>
            <div style={{ fontSize: "13px", opacity: 0.95 }}>
                LeetCode & Codeforces Contest & Squad Manager
            </div>
        </div>
    );
};

export default Header;
