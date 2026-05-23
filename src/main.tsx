import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initThemeBeforeMount } from "./lib/theme";

initThemeBeforeMount();

createRoot(document.getElementById("root")!).render(<App />);
