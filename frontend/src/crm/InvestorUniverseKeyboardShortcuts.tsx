import { useState } from "react";

export function InvestorUniverseKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);

  const shortcuts = [
    { key: "⌘/Ctrl + A", action: "Select all visible investors" },
    { key: "Esc", action: "Clear selection" },
    { key: "/", action: "Focus search" },
    { key: "↑/↓", action: "Navigate table rows" },
    { key: "Enter", action: "Open selected investor" },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setShowHelp(true)}
        className="fixed bottom-6 left-6 z-40 bg-black text-white rounded-full w-10 h-10 flex items-center justify-center text-xs font-mono hover:bg-gray-800 border-2 border-white shadow-lg"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl border-2 border-black p-6 max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Keyboard Shortcuts</h2>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="text-gray-500 hover:text-black"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.key}
                  className="flex items-center justify-between py-2 border-b border-gray-200"
                >
                  <kbd className="px-2 py-1 bg-gray-100 rounded font-mono text-xs">
                    {shortcut.key}
                  </kbd>
                  <span className="text-sm text-gray-700">{shortcut.action}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-500">
              Press <kbd className="px-1 py-0.5 bg-gray-100 rounded">Esc</kbd> to
              close
            </p>
          </div>
        </div>
      )}
    </>
  );
}
