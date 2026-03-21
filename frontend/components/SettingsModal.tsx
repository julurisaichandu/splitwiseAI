"use client";
import { useAuth } from "./AuthContext";

export default function SettingsModal() {
  const { isAuthenticated, userName, login, logout } = useAuth();

  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
      {isAuthenticated ? (
        <>
          <span className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-sm border border-stone-200 text-sm font-medium text-stone-700">
            {userName}
          </span>
          <button
            onClick={logout}
            className="p-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-stone-200 hover:bg-white hover:shadow-xl transition-all duration-150 group"
            title="Logout"
          >
            <svg
              className="w-5 h-5 text-stone-600 group-hover:text-red-500 transition-colors"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-400" />
          </button>
        </>
      ) : (
        <button
          onClick={login}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-stone-200 hover:bg-white hover:shadow-xl transition-all duration-150 group"
          title="Login with Splitwise"
        >
          <svg
            className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
            />
          </svg>
          <span className="text-sm font-medium text-stone-700 group-hover:text-amber-700">
            Login with Splitwise
          </span>
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-red-400" />
        </button>
      )}
    </div>
  );
}
