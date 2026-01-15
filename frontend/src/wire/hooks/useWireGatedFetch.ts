import { useCallback } from "react";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export function useWireGatedFetch(approvalToken: string | null) {
  const toast = useToast();

  const fetch = useCallback(
    async (url: string, options?: RequestInit): Promise<Response> => {
      const headers = new Headers(options?.headers);

      if (approvalToken) {
        headers.set("X-POSE-APPROVAL", approvalToken);
        headers.set("X-POSE-IDEMPOTENCY", crypto.randomUUID());
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        toast.push({
          tone: "warning",
          message: "Approval token expired. Please re-approve.",
        });
      }

      return response;
    },
    [approvalToken, toast]
  );

  return { fetch };
}
