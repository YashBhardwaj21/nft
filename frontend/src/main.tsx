import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./App.css";
// import { web3Modal } from "./lib/web3Modal"; // Initialize Web3Modal - DISABLING TO FIX WHITE SCREEN

const root = document.getElementById("root") as HTMLElement | null;

if (!root) {
    throw new Error('Root element with id="root" not found. Make sure your index.html contains <div id="root"></div>.');
}

// Global Click Tracker
document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const button = target.closest('button');
    const link = target.closest('a');

    if (button) {
        console.log(`[USER CLICK] Button: ${button.innerText || button.id || button.className || 'Unknown Button'}`);
    } else if (link) {
        console.log(`[USER CLICK] Link: ${link.innerText || link.href || 'Unknown Link'}`);
    } else {
        // Optional: uncomment below to log *every* click, even on empty divs
        // console.log(`[USER CLICK] Element: ${target.tagName}`, target);
    }
});

createRoot(root).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
