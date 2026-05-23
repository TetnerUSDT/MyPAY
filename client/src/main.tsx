import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/i18n";

const root = createRoot(document.getElementById("root")!);
root.render(<App />);

// Remove static HTML preloader after the first React paint
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const el = document.getElementById('static-preloader');
    if (el) {
      el.classList.add('hiding');
      setTimeout(() => el.remove(), 150);
    }
  });
});
