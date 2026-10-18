"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbfafc",
          color: "#1c1528",
          fontFamily: "Heebo, Arial, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <main>
          <p style={{ letterSpacing: "0.28em", fontWeight: 800, color: "#6d28d9" }}>LOLO</p>
          <h1 style={{ marginTop: 24, fontSize: 28 }}>משהו השתבש</h1>
          <p style={{ marginTop: 12, color: "#6b6178", lineHeight: 1.6 }}>
            לא הצלחנו לטעון את האפליקציה. אפשר לנסות שוב.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              height: 48,
              border: 0,
              borderRadius: 999,
              background: "#6d28d9",
              color: "white",
              padding: "0 24px",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            נסו שוב
          </button>
        </main>
      </body>
    </html>
  );
}
