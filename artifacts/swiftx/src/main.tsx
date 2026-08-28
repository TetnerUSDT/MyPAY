import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
// i18n must be initialized synchronously — components using useTranslation()
// otherwise render translation keys (e.g. "nav.home") on first paint.
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
