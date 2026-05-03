import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/i18n";
import { loadAnimation } from "./lib/preloaderRegistry";

// Pre-load the default Lottie animation immediately so it's cached
// by the time React's PreloaderOverlay renders — eliminates spinner flash
loadAnimation('default');

createRoot(document.getElementById("root")!).render(<App />);
