import { HudThemeProvider, initHudLocaleOnDom, initHudThemeOnDom } from "@exile-hud/hud-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { initPwaServiceWorker } from "./features/pwa_refresh/pwa_service_worker_controller.js";
import "./index.css";

initHudThemeOnDom();
initHudLocaleOnDom();
initPwaServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HudThemeProvider>
      <App />
    </HudThemeProvider>
  </StrictMode>,
);
