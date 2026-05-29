"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus() {
  // Initialise from navigator.onLine on the client so the very first render
  // is correct (instead of always assuming online until the useEffect fires).
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== "undefined") return navigator.onLine;
    return true; // SSR default — we only know the truth client-side
  });

  useEffect(() => {
    // Re-sync immediately in case the lazy initialiser ran in a stale context
    setIsOnline(navigator.onLine);

    const goOnline  = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return isOnline;
}
