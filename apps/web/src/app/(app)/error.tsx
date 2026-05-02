"use client";

type AppErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppErrorPage({ error, reset }: AppErrorPageProps) {
  return (
    <main style={{ padding: 24 }}>
      <h1>Something went wrong</h1>
      <p>{error.message}</p>
      <button onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
