import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./App.css";

const root = document.getElementById("root") as HTMLElement | null;

if (!root) {
    throw new Error('Root element with id="root" not found. Make sure your index.html contains <div id="root"></div>.');
}

createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
