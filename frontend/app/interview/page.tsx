"use client";

import CodeEditor from "@/components/CodeEditor";
import VideoCall from "@/components/VideoCall";

export default function EditorPage() {
  return (
    <main
      style={{
        height: "100vh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr", // 👈 50% / 50%
        gap: 12,
        padding: 12,
        background: "#f9fafb",
      }}
    >
      {/* LEFT — CODE EDITOR */}
      <section
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 900,
            fontSize: 16,
          }}
        >
          💻 Code Editor
        </div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <CodeEditor />
        </div>
      </section>

      {/* RIGHT — VIDEO CALL */}
      <section
        style={{
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          background: "white",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid #e5e7eb",
            fontWeight: 900,
            fontSize: 16,
          }}
        >
          🎥 Live Interview
        </div>

        <div style={{ flex: 1, padding: 12 }}>
          <VideoCall roomId="room-123" />
        </div>
      </section>

      {/* Responsive mobile layout */}
      <style jsx>{`
        @media (max-width: 980px) {
          main {
            grid-template-columns: 1fr !important;
            height: auto;
          }
        }
      `}</style>
    </main>
  );
}