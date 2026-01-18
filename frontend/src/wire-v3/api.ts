const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function getAuthHeaders() {
  const token = localStorage.getItem("wire_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error || "Request failed";
    throw new Error(message);
  }
  return data as T;
}

export async function createConfirmSession(payload: {
  amountMinor: string;
  currency: string;
  beneficiaryId: string;
  purpose?: string;
  clientConfirmationId: string;
  deviceFingerprint?: string;
}) {
  return request<{
    sessionId: string;
    challengeId: string;
    challengePhrase: string;
    challengePhraseDisplay: string;
    intentId: string;
    expiresAt: string;
    state: "voice_required";
    policyOutcome?: string;
  } | { status: "failed"; error: string }>("/api/v3/confirm-sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitVoice(sessionId: string, payload: {
  audioBuffer: string;
  transcript?: string;
  deviceFingerprint?: string;
}) {
  return request<any>(`/api/v3/confirm-sessions/${sessionId}/voice`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getConfirmSession(sessionId: string) {
  return request<any>(`/api/v3/confirm-sessions/${sessionId}`, {
    method: "GET",
  });
}

export async function cancelConfirmSession(sessionId: string) {
  return request<any>(`/api/v3/confirm-sessions/${sessionId}/cancel`, {
    method: "POST",
  });
}
