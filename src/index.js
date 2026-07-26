// ── Polyfills — must be first imports (for TV Browser / older Android WebView) ──
import 'react-app-polyfill/ie11';
import 'react-app-polyfill/stable';

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter } from "react-router-dom";

const rootEl = document.getElementById("root");

try {
  // React 18/19 — modern browsers
  const root = ReactDOM.createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
} catch (e) {
  // Fallback for old TV browsers that don't support createRoot
  ReactDOM.render(
    <BrowserRouter>
      <App />
    </BrowserRouter>,
    rootEl
  );
}

reportWebVitals();

// ── PWA Service Worker ──
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("Zixplon SW registered:", reg.scope))
      .catch((err) => console.log("Zixplon SW failed:", err));
  });
}