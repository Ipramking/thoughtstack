"use client";

import { useState, useCallback } from "react";
import { Location } from "@/types";
import { toast } from "@/hooks/useToast";

export function useGeolocation() {
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback((): Promise<Location | null> => {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        toast.error("Geolocation not supported on this device");
        resolve(null);
        return;
      }
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLoading(false);
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            label: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
          });
        },
        (err) => {
          setLoading(false);
          if (err.code === err.PERMISSION_DENIED) {
            toast.error("Location access denied");
          } else {
            toast.error("Could not get your location");
          }
          resolve(null);
        },
        { timeout: 8000, maximumAge: 60000 }
      );
    });
  }, []);

  const openInMaps = useCallback((loc: Location) => {
    const label = encodeURIComponent(loc.label ?? "ThoughtStack Location");
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}&query_place_id=${label}`,
      "_blank",
    );
  }, []);

  return { loading, getLocation, openInMaps };
}
