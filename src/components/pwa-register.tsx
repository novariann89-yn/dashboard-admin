"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    // Service workers need a secure context (HTTPS or localhost).
    if (typeof window !== "undefined" && !window.isSecureContext) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline mode is a bonus; ignore registration failures.
    });
  }, []);

  return null;
}