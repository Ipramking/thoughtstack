"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Pomodoro / focus timer.
 *
 * Storage: the running timer state is persisted to localStorage so the
 * countdown survives navigation between pages (timer continues even if you
 * leave the active page).
 *
 * Notification: when the timer reaches zero, posts a SW notification via the
 * existing reminders pipeline so the user is notified even if the tab is
 * backgrounded.
 */

const STORAGE_KEY = "ts-focus-timer";

interface PersistedTimer {
  startedAt: number;       // ms epoch
  durationMs: number;
  taskId?:   string;
  taskTitle?: string;
}

function loadPersisted(): PersistedTimer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedTimer;
    if (!parsed.startedAt || !parsed.durationMs) return null;
    return parsed;
  } catch { return null; }
}

function savePersisted(timer: PersistedTimer | null) {
  if (typeof window === "undefined") return;
  try {
    if (timer === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timer));
  } catch {/* ignore */}
}

export interface FocusTimerState {
  active:      boolean;
  remainingMs: number;
  durationMs:  number;
  taskTitle?:  string;
  start:       (durationMin: number, taskTitle?: string, taskId?: string) => void;
  stop:        () => void;
}

export function useFocusTimer(): FocusTimerState {
  const [tick, setTick]     = useState(0);
  const persistedRef        = useRef<PersistedTimer | null>(loadPersisted());

  const update = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!persistedRef.current) return;

    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [tick, update]);

  const persisted = persistedRef.current;
  const remainingMs = persisted
    ? Math.max(0, persisted.durationMs - (Date.now() - persisted.startedAt))
    : 0;
  const active = persisted !== null && remainingMs > 0;

  // Fire the "complete" notification once when crossing zero
  useEffect(() => {
    if (!persisted) return;
    if (remainingMs > 0) return;

    void (async () => {
      try {
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification("🎯 Focus session complete", {
            body: persisted.taskTitle
              ? `Done with ${persisted.taskTitle}. Take a 5-minute break.`
              : `${Math.round(persisted.durationMs / 60000)} minutes focused — well done.`,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag:   "focus-complete",
          });
        }
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([200, 100, 200, 100, 200]);
        }
      } catch {/* notifications denied — silent */}
      persistedRef.current = null;
      savePersisted(null);
      update();
    })();
  }, [remainingMs, persisted, update]);

  const start = useCallback((durationMin: number, taskTitle?: string, taskId?: string) => {
    const t: PersistedTimer = {
      startedAt:  Date.now(),
      durationMs: durationMin * 60 * 1000,
      taskId,
      taskTitle,
    };
    persistedRef.current = t;
    savePersisted(t);
    update();
  }, [update]);

  const stop = useCallback(() => {
    persistedRef.current = null;
    savePersisted(null);
    update();
  }, [update]);

  return {
    active,
    remainingMs: active ? remainingMs : 0,
    durationMs:  persisted?.durationMs ?? 0,
    taskTitle:   persisted?.taskTitle,
    start,
    stop,
  };
}
