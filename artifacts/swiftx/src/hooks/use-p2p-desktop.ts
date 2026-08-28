import { useEffect, useState } from "react";

const DESKTOP_P2P_QUERY = "(min-width: 1024px)";

export function useP2PDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_P2P_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_P2P_QUERY);
    const update = () => setIsDesktop(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}