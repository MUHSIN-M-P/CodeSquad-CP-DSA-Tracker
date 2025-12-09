import React from "react";

const Header: React.FC = () => {
    return (
        <div
            style={{
                background: "linear-gradient(135deg, #1a1f26 0%, #0d1117 100%)",
                borderBottom: "2px solid var(--primary)",
                color: "white",
                padding: "24px 20px",
                textAlign: "center",
            }}
        >
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
                LeetCode Contest & Squad Manager
            </div>
        </div>
    );
};

export default Header;
