"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function ScrollFab() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight > 240;
      setVisible(scrollable);
    }
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="scroll-fab"
      role="group"
      aria-label="Ir ao topo ou ao fim da página"
    >
      <button
        type="button"
        className="scroll-fab-btn"
        aria-label="Subir tudo"
        title="Subir tudo"
        onClick={() =>
          window.scrollTo({ top: 0, behavior: "smooth" })
        }
      >
        <ChevronUp size={20} />
      </button>
      <button
        type="button"
        className="scroll-fab-btn"
        aria-label="Descer tudo"
        title="Descer tudo"
        onClick={() =>
          window.scrollTo({
            top: document.documentElement.scrollHeight,
            behavior: "smooth",
          })
        }
      >
        <ChevronDown size={20} />
      </button>
    </div>
  );
}
