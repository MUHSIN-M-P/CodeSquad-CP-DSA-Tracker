import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import "./popup.css";
import Header from "../components/Header";
import TabBar from "../components/TabBar";
import SearchTab from "../components/SearchTab";
import SquadTab from "../components/SquadTab";
import ErrorBox from "../components/ErrorBox";

type TabType = "search" | "squad";

function Popup() {
    const [activeTab, setActiveTab] = useState<TabType>("search");
    const [error, setError] = useState<string>("");

    const showError = (msg: string) => {
        setError(msg);
        setTimeout(() => setError(""), 5000);
    };

    const clearError = () => {
        setError("");
    };

    return (
        <div style={{ width: "420px", minHeight: "500px" }}>
            <Header />
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
            <ErrorBox message={error} />
            <div style={{ padding: "20px" }}>
                {activeTab === "search" && (
                    <SearchTab showError={showError} clearError={clearError} />
                )}
                {activeTab === "squad" && <SquadTab showError={showError} />}
            </div>
        </div>
    );
}

const root = document.getElementById("root");
if (root) {
    ReactDOM.createRoot(root).render(
        <React.StrictMode>
            <Popup />
        </React.StrictMode>
    );
}
