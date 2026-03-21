"use client";
import { useState, useEffect, useRef } from "react";

interface ApiKeys {
  SPLITWISE_CONSUMER_KEY: string;
  SPLITWISE_SECRET_KEY: string;
  SPLITWISE_API_KEY: string;
  GEMINI_API_KEY: string;
}

const STORAGE_KEY = "splitwise_ai_credentials";

export function loadApiKeys(): ApiKeys {
  if (typeof window === "undefined") {
    return {
      SPLITWISE_CONSUMER_KEY: "",
      SPLITWISE_SECRET_KEY: "",
      SPLITWISE_API_KEY: "",
      GEMINI_API_KEY: "",
    };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore parse errors
  }
  return {
    SPLITWISE_CONSUMER_KEY: "",
    SPLITWISE_SECRET_KEY: "",
    SPLITWISE_API_KEY: "",
    GEMINI_API_KEY: "",
  };
}

export function saveApiKeys(keys: ApiKeys) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function hasApiKeys(): boolean {
  const keys = loadApiKeys();
  return !!(
    keys.SPLITWISE_CONSUMER_KEY &&
    keys.SPLITWISE_SECRET_KEY &&
    keys.SPLITWISE_API_KEY &&
    keys.GEMINI_API_KEY
  );
}

interface SettingsModalProps {
  onSave: (keys: ApiKeys) => void;
}

export default function SettingsModal({ onSave }: SettingsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [keys, setKeys] = useState<ApiKeys>({
    SPLITWISE_CONSUMER_KEY: "",
    SPLITWISE_SECRET_KEY: "",
    SPLITWISE_API_KEY: "",
    GEMINI_API_KEY: "",
  });
  const [showKeys, setShowKeys] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setKeys(loadApiKeys());
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const handleSave = () => {
    saveApiKeys(keys);
    onSave(keys);
    setIsOpen(false);
  };

  const handleClear = () => {
    const empty: ApiKeys = {
      SPLITWISE_CONSUMER_KEY: "",
      SPLITWISE_SECRET_KEY: "",
      SPLITWISE_API_KEY: "",
      GEMINI_API_KEY: "",
    };
    setKeys(empty);
    saveApiKeys(empty);
    onSave(empty);
    setIsOpen(false);
  };

  const isComplete = !!(
    keys.SPLITWISE_CONSUMER_KEY &&
    keys.SPLITWISE_SECRET_KEY &&
    keys.SPLITWISE_API_KEY &&
    keys.GEMINI_API_KEY
  );

  const fields: { key: keyof ApiKeys; label: string; placeholder: string; helpUrl: string; helpText: string }[] = [
    {
      key: "SPLITWISE_CONSUMER_KEY",
      label: "Splitwise Consumer Key",
      placeholder: "Your Splitwise OAuth consumer key",
      helpUrl: "https://secure.splitwise.com/apps",
      helpText: "Register an app to get your Consumer Key",
    },
    {
      key: "SPLITWISE_SECRET_KEY",
      label: "Splitwise Secret Key",
      placeholder: "Your Splitwise OAuth secret key",
      helpUrl: "https://secure.splitwise.com/apps",
      helpText: "Found under your registered app as Consumer Secret",
    },
    {
      key: "SPLITWISE_API_KEY",
      label: "Splitwise API Key",
      placeholder: "Your Splitwise API key",
      helpUrl: "https://secure.splitwise.com/apps",
      helpText: "Found under your registered app details",
    },
    {
      key: "GEMINI_API_KEY",
      label: "Gemini API Key",
      placeholder: "Your Google Gemini API key",
      helpUrl: "https://aistudio.google.com/apikey",
      helpText: "Create a free API key in Google AI Studio",
    },
  ];

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 right-4 z-50 p-2.5 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-stone-200 hover:bg-white hover:shadow-xl transition-all duration-150 group"
        title="API Settings"
      >
        <svg
          className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors group-hover:rotate-90 duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        {/* Status dot */}
        <span
          className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            hasApiKeys() ? "bg-emerald-400" : "bg-red-400"
          }`}
        />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-stone-50">
              <div>
                <h2 className="text-lg font-semibold text-stone-800">
                  API Settings
                </h2>
                <p className="text-sm text-stone-500">
                  Credentials are stored in your browser only
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-stone-200 transition-colors"
              >
                <svg
                  className="w-5 h-5 text-stone-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Toggle visibility */}
              <button
                onClick={() => setShowKeys(!showKeys)}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium flex items-center gap-1.5"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {showKeys ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.879L21 21"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  )}
                </svg>
                {showKeys ? "Hide keys" : "Show keys"}
              </button>

              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type={showKeys ? "text" : "password"}
                    value={keys[field.key]}
                    onChange={(e) =>
                      setKeys({ ...keys, [field.key]: e.target.value })
                    }
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 border border-stone-300 rounded-lg text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none transition-all duration-150 text-sm"
                    autoComplete="off"
                  />
                  <a
                    href={field.helpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1.5 text-xs text-amber-600 hover:text-amber-700 hover:underline"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    {field.helpText}
                  </a>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-stone-200 bg-stone-50">
              <button
                onClick={handleClear}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear All
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!isComplete}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                    isComplete
                      ? "bg-amber-600 text-white hover:bg-amber-700 active:scale-95"
                      : "bg-stone-200 text-stone-400 cursor-not-allowed"
                  }`}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
