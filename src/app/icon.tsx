import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0d0d",
          borderRadius: "40px",
        }}
      >
        <div
          style={{
            fontSize: 110,
            fontWeight: 900,
            color: "#ffffff",
            letterSpacing: "-4px",
            fontFamily: "sans-serif",
            lineHeight: 1,
          }}
        >
          T
        </div>
      </div>
    ),
    size
  );
}
