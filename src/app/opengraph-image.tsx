import { ImageResponse } from "next/og";

export const alt = "Reckon — a calibration gym for friends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link-preview card for group chats: the wordmark plus a little calibration plot.
export default function OpengraphImage() {
  const px = (v: number) => 40 + v * 320;
  const py = (v: number) => 40 + (1 - v) * 320;
  const dots: [number, number][] = [
    [0.1, 0.22],
    [0.3, 0.34],
    [0.5, 0.5],
    [0.7, 0.62],
    [0.9, 0.73],
  ];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: "#f6f5f1", padding: "0 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, paddingRight: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="15" fill="#16150f" />
              <line x1="14" y1="50" x2="50" y2="14" stroke="#77756f" strokeWidth="3" strokeLinecap="round" />
              <circle cx="22" cy="44" r="5.5" fill="#3987e5" />
              <circle cx="33" cy="29" r="5.5" fill="#3987e5" />
              <circle cx="45" cy="21" r="5.5" fill="#3987e5" />
            </svg>
            <div style={{ fontSize: 56, fontWeight: 700, color: "#16150f", letterSpacing: -1 }}>Reckon</div>
          </div>
          <div style={{ marginTop: 48, fontSize: 64, lineHeight: 1.05, fontWeight: 700, color: "#16150f", letterSpacing: -1.5 }}>
            How often do your 90%s actually happen?
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: "#52514e" }}>Predict things with friends. Find out how calibrated you are.</div>
        </div>
        <svg width="400" height="400" viewBox="0 0 400 400">
          <rect x="0" y="0" width="400" height="400" rx="28" fill="#fdfdfb" />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={`h${t}`} x1={px(0)} x2={px(1)} y1={py(t)} y2={py(t)} stroke="#e1e0d9" strokeWidth="2" />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line key={`v${t}`} x1={px(t)} x2={px(t)} y1={py(0)} y2={py(1)} stroke="#e1e0d9" strokeWidth="2" />
          ))}
          <line x1={px(0)} y1={py(0)} x2={px(1)} y2={py(1)} stroke="#c3c2b7" strokeWidth="3" />
          {dots.map(([x, y]) => (
            <circle key={x} cx={px(x)} cy={py(y)} r="13" fill="#2a78d6" stroke="#fdfdfb" strokeWidth="4" />
          ))}
        </svg>
      </div>
    ),
    size,
  );
}
