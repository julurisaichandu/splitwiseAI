"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-[var(--background)]">
      <div className="rounded-2xl p-8 max-w-md text-center shadow-lg bg-[var(--card)] border border-[var(--border)]">
        <div className="text-6xl mb-4">📡</div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          You&apos;re Offline
        </h1>
        <p className="text-[var(--text-secondary)] mb-6">
          SplitWise AI needs an internet connection to analyze bills and sync
          with Splitwise. Please check your connection and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl font-medium hover:bg-[var(--primary-hover)] transition-colors cursor-pointer"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
