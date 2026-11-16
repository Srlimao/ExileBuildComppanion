import { HudThemeProvider, initHudLocaleOnDom, initHudThemeOnDom } from "@exile-hud/hud-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App.js";
import "./index.css";

initHudThemeOnDom();
initHudLocaleOnDom();
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HudThemeProvider>
      <App />
    </HudThemeProvider>
  </StrictMode>,
);
