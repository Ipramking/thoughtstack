import { ImageResponse } from "next/og";

// 512×512 — used by manifest + apple-touch-icon
export const size        = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#0d0d0d",
          borderRadius: "112px",   // ~22% of 512px — matches iOS squircle
        }}
      >
        {/* "T" wordmark */}
        <div
          style={{
            fontSize: 300, fontWeight: 900,
            color: "#ffffff",
            fontFamily: "sans-serif",
            lineHeight: 1,
            letterSpacing: "-8px",
            marginTop: "16px",
          }}
        >
          T
        </div>
      </div>
    ),
    size,
  );
}
