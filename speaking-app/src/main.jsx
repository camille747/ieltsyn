import React from "react";
import { createRoot } from "react-dom/client";
import App from "./speaking/App.jsx";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/700.css";
import "@fontsource/source-serif-4/400.css";
import "@fontsource/source-serif-4/700.css";
import "@fontsource/source-serif-4/400-italic.css";
import "./speaking/style.css";
import "../../src/design-system.css";
import "../../src/learning-ui.css";
import "./speaking/studio-ui.css";

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
