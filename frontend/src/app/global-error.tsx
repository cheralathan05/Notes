'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center p-6 font-mono">
        <div className="max-w-md w-full p-6 border border-[#222222] bg-[#111111] rounded space-y-4 text-center">
          <h2 className="text-lg font-semibold tracking-wider text-[#FAFAFA]">SYSTEM EXCEPTION</h2>
          <p className="text-xs text-[#888888]">
            {error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-[#222222] hover:bg-[#333333] border border-[#333333] text-xs font-mono text-[#FAFAFA] rounded transition-colors"
          >
            Reinitialize Boundary
          </button>
        </div>
      </body>
    </html>
  );
}
