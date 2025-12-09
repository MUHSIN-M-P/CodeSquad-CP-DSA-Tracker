import React from "react";

interface ErrorBoxProps {
    message: string;
}

const ErrorBox: React.FC<ErrorBoxProps> = ({ message }) => {
    if (!message) return null;

    return (
        <div
            style={{
                background: "var(--error-bg)",
                border: "1.5px solid var(--error)",
                color: "var(--error)",
                padding: "14px",
                borderRadius: "var(--radius)",
                fontSize: "13px",
                margin: "16px 20px",
            }}
        >
            ⚠️ {message}
        </div>
    );
};

export default ErrorBox;
