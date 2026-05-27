"use client";

import { useRef, useCallback } from "react";

interface SwipeOptions {
  onSwipeLeft?:  () => void;
  onSwipeRight?: () => void;
  threshold?: number; // px
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }: SwipeOptions) {
  const startX  = useRef(0);
  const startY  = useRef(0);
  const swiping = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current  = e.touches[0].clientX;
    startY.current  = e.touches[0].clientY;
    swiping.current = false;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - startX.current;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll — ignore
    if (dx >  threshold && onSwipeRight) onSwipeRight();
    if (dx < -threshold && onSwipeLeft)  onSwipeLeft();
  }, [onSwipeLeft, onSwipeRight, threshold]);

  return { onTouchStart, onTouchEnd };
}
