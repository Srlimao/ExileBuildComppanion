import { HudThemeProvider, initHudThemeOnDom } from "@exile-hud/hud-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { OverlayHudApp } from "./features/overlay_hud/overlay_hud_app.js";
import "./index.css";

initHudThemeOnDom();
const windowMode = new URLSearchParams(window.location.search).get("window");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HudThemeProvider>
      {windowMode === "overlay" ? <OverlayHudApp /> : <App />}
    </HudThemeProvider>
  </StrictMode>,
);
