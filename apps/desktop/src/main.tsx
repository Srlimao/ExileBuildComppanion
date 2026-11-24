import { HudThemeProvider, initHudLocaleOnDom, initHudThemeOnDom } from "@exile-hud/hud-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { BuildFinderWindowApp } from "./features/build_finder/build_finder_window_app.js";
import { OverlayHudApp } from "./features/overlay_hud/overlay_hud_app.js";
import "./index.css";

initHudThemeOnDom();
initHudLocaleOnDom();
const windowMode = new URLSearchParams(window.location.search).get("window");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HudThemeProvider>
      {windowMode === "overlay" ? (
        <OverlayHudApp />
      ) : windowMode === "build-finder" ? (
        <BuildFinderWindowApp />
      ) : (
        <App />
      )}
    </HudThemeProvider>
  </StrictMode>,
);
