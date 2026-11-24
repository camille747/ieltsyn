import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/source-serif-4/400-italic.css";
import App from "./App";
import "./styles.css";
import "./design-system.css";
import "./learning-ui.css";
import "./vendor/timer-suite/timer-suite.js";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
