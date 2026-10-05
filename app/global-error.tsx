"use client"

// Last resort when the root layout itself fails. It replaces the whole
// document, so it can't rely on the app's styles, fonts or theme.
export default function GlobalError({
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          textAlign: "center",
        }}
      >
        <title>Something went wrong · Pastelito</title>
        <div>
          <h1 style={{ fontSize: "1.25rem" }}>Something went wrong</h1>
          <p style={{ opacity: 0.7 }}>
            Pastelito couldn&apos;t load. Try again in a moment.
          </p>
          <button onClick={() => retry()} style={{ padding: "0.5rem 1rem" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
