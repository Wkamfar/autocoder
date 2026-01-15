// Component to show current API mode (mock vs real) for debugging
import { API_CONFIG, isMockMode } from '../api';

export function ApiModeIndicator() {
  if (import.meta.env.DEV) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-black text-white text-xs px-3 py-2 rounded-lg border-2 border-white shadow-lg">
        <div className="font-bold">
          API Mode: <span className={isMockMode() ? 'text-yellow-400' : 'text-green-400'}>
            {API_CONFIG.mode.toUpperCase()}
          </span>
        </div>
        {!isMockMode() && (
          <div className="text-gray-400 mt-1">
            {API_CONFIG.baseUrl}
          </div>
        )}
      </div>
    );
  }
  return null;
}
