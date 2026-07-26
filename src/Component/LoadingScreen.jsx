import React, { useEffect, useState } from "react";

const LoadingScreen = ({ onFinish }) => {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFade(true), 1800);
    const doneTimer = setTimeout(() => onFinish && onFinish(), 2300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish]);

  return (
    <div
  style={{
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
    width: "100vw",
    height: "100vh",
    background: "#000000",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    margin: "0",
    padding: "0",
    boxSizing: "border-box",
    zIndex: 9999,
    opacity: fade ? 0 : 1,
    transition: "opacity 0.5s ease",
  }}
>
      {/* ── Crisp inline SVG logo — no image file, never blurs ── */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        style={{ width: "180px", height: "180px", display: "block" }}
      >
        {/* Red rounded square */}
        <rect x="0" y="0" width="512" height="512" rx="110" ry="110" fill="#CC0000" />
        {/* Top shine */}
        <rect x="0" y="0" width="512" height="260" rx="110" ry="110" fill="#E81515" opacity="0.55" />
        {/* Bold white Z */}
        <polygon
          points="108,108 404,108 404,178 220,334 404,334 404,404 108,404 108,334 292,178 108,178"
          fill="#FFFFFF"
        />
      </svg>

      {/* ── App name ── */}
      <p
        style={{
          marginTop: "24px",
          color: "#ffffff",
          fontSize: "26px",
          fontWeight: "800",
          fontFamily: "'Outfit', 'Nunito', sans-serif",
          letterSpacing: "6px",
          textTransform: "uppercase",
          opacity: 0.92,
        }}
      >
        ZIXPLON
      </p>

      {/* ── Subtle loading dots ── */}
      <div style={{ display: "flex", gap: "8px", marginTop: "40px" }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "#CC0000",
              animation: `bounce 1s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40%            { transform: scale(1.2); opacity: 1;   }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;