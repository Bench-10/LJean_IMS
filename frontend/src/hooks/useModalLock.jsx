import { useEffect, useRef } from "react";

export default function useModalLock(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  const hasPushedRef = useRef(false);
  const scrollYRef = useRef(0);

  // Always keep the latest onClose
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      return; // do nothing if modal is not open
    }

    if (typeof window === "undefined" || typeof document === "undefined") return;

    const body = document.body;
    const html = document.documentElement;

    // Save current scroll position
    scrollYRef.current =
      window.scrollY || html.scrollTop || body.scrollTop || 0;

    // 🔒 Lock background scroll
    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollYRef.current}px`;
    body.style.width = "100%";

    // Push a dummy history entry so the FIRST "back" is captured for the modal
    if (!hasPushedRef.current) {
      try {
        window.history.pushState({ __modal__: true }, "");
        hasPushedRef.current = true;
      } catch {
        // ignore history errors (very rare)
      }
    }

    const handlePopState = () => {
      // Only intercept once per open
      if (!hasPushedRef.current) return;

      hasPushedRef.current = false;

      // Close the modal instead of navigating away
      if (onCloseRef.current) {
        onCloseRef.current();
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);

      // Restore body scroll styles
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;

      // Restore scroll position
      window.scrollTo(0, scrollYRef.current);

      hasPushedRef.current = false;
    };
  }, [isOpen]);
}
