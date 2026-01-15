import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { TransferIntent, Beneficiary } from "../types/wire";
import { useToast } from "../../crm/ui/CrmDesignSystem";

// List intents
export function useWireIntents() {
  return useQuery({
    queryKey: ["wire", "intents"],
    queryFn: () => api.getIntents(),
  });
}

// Get single intent
export function useWireIntent(intentId: string) {
  return useQuery({
    queryKey: ["wire", "intents", intentId],
    queryFn: () => api.getIntent(intentId),
    enabled: !!intentId,
  });
}

// Create intent
export function useCreateIntent() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: Partial<TransferIntent>) => api.createIntent(data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wire", "intents"] });
      toast.push({
        tone: "success",
        message: "Intent created successfully",
      });
    },
    onError: (error) => {
      toast.push({
        tone: "danger",
        message: error instanceof Error ? error.message : "Failed to create intent",
      });
    },
  });
}

// Update intent
export function useUpdateIntent() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TransferIntent> }) =>
      api.updateIntent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["wire", "intents"] });
      queryClient.invalidateQueries({ queryKey: ["wire", "intents", variables.id] });
      toast.push({
        tone: "success",
        message: "Intent updated. Previous approvals invalidated.",
      });
    },
  });
}

// Beneficiaries
export function useWireBeneficiaries() {
  return useQuery({
    queryKey: ["wire", "beneficiaries"],
    queryFn: () => api.getBeneficiaries(),
  });
}

export function useCreateBeneficiary() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (data: Partial<Beneficiary>) => api.createBeneficiary(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wire", "beneficiaries"] });
      toast.push({
        tone: "success",
        message: "Beneficiary created",
      });
    },
    onError: (error) => {
      toast.push({
        tone: "danger",
        message: error instanceof Error ? error.message : "Failed to create beneficiary",
      });
    },
  });
}

export function useLockBeneficiary() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (id: string) => api.lockBeneficiary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wire", "beneficiaries"] });
      toast.push({
        tone: "success",
        message: "Beneficiary locked",
      });
    },
    onError: (error) => {
      toast.push({
        tone: "danger",
        message: error instanceof Error ? error.message : "Failed to lock beneficiary",
      });
    },
  });
}

// Approval Status
export function useApprovalStatus(intentId: string) {
  return useQuery({
    queryKey: ["wire", "approval-status", intentId],
    queryFn: () => api.getApprovalStatus(intentId),
    enabled: !!intentId,
  });
}

// Create Decision
export function useCreateDecision() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({
      intentId,
      action,
      proofId,
    }: {
      intentId: string;
      action: "APPROVE" | "DENY" | "STEP_UP";
      proofId: string;
    }) => api.createDecision(intentId, action, proofId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wire", "intents"] });
      toast.push({
        tone: "success",
        message: "Decision created. Intent approved.",
      });
    },
    onError: (error) => {
      toast.push({
        tone: "danger",
        message: error instanceof Error ? error.message : "Failed to create decision",
      });
    },
  });
}

// Event Logs
export function useEventLogs(intentId: string) {
  return useQuery({
    queryKey: ["wire", "event-logs", intentId],
    queryFn: () => api.getEventLogs(intentId),
    enabled: !!intentId,
  });
}

// Policy
export function usePolicy() {
  return useQuery({
    queryKey: ["wire", "policy"],
    queryFn: () => api.getPolicy(),
  });
}

// Service Health
export function useServiceHealth() {
  return useQuery({
    queryKey: ["wire", "service-health"],
    queryFn: () => api.getServiceHealth(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}
