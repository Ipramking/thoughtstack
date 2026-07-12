import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #7454d4 0%, #a24fdc 100%)",
          borderRadius: "42px",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 900, color: "#ffffff", fontFamily: "sans-serif", lineHeight: 1, marginTop: "8px" }}>
          T
        </div>
      </div>
    ),
    { width: 192, height: 192 },
  );
}
