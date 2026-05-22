"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center ambient-bg">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 3l18 18M8.111 8.111A5.5 5.5 0 0115.5 6.5h.5a7 7 0 016.4 9.8M6.5 15.5A7 7 0 0113 7m-4.5 8.5L6 18m12 0h.01" />
        </svg>
      </div>
      <h1 className="text-xl font-bold mb-2">You&apos;re offline</h1>
      <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
        ThoughtStack needs an internet connection to sync your data and AI features. Your local data is still safe.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
