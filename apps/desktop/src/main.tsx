import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { OverlayHudApp } from "./features/overlay_hud/overlay_hud_app.js";
import "./index.css";

const windowMode = new URLSearchParams(window.location.search).get("window");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {windowMode === "overlay" ? <OverlayHudApp /> : <App />}
  </StrictMode>,
);
