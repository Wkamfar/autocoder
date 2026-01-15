/**
 * Webhooks Management Page
 */

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

const WEBHOOK_EVENTS = [
  "intent.created",
  "intent.updated",
  "intent.approved",
  "intent.denied",
  "intent.executed",
  "intent.canceled",
  "challenge.created",
  "proof.submitted",
  "decision.made",
  "beneficiary.created",
  "beneficiary.updated",
  "beneficiary.locked",
] as const;

export default function WireWebhooksPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSecretModal, setShowSecretModal] = useState(false);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [expandedWebhookId, setExpandedWebhookId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    events: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ["webhooks"],
    queryFn: () => wireApi.getWebhooks(),
  });

  const deliveriesQuery = useQuery({
    queryKey: ["webhookDeliveries", expandedWebhookId],
    queryFn: () => (expandedWebhookId ? wireApi.getWebhookDeliveries(expandedWebhookId, 25) : Promise.resolve([])),
    enabled: !!expandedWebhookId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; url: string; events: string[] }) =>
      wireApi.createWebhook(data),
    onSuccess: (data) => {
      setNewWebhookSecret(data.secret);
      setShowSecretModal(true);
      setExpandedWebhookId(null);
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.push({
        tone: "success",
        message: "Webhook created successfully",
      });
      setFormData({ name: "", url: "", events: [] });
      setShowCreateModal(false);
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to create webhook",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      wireApi.updateWebhook(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.push({
        tone: "success",
        message: "Webhook updated",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to update webhook",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wireApi.deleteWebhook(id),
    onSuccess: () => {
      setExpandedWebhookId(null);
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.push({
        tone: "success",
        message: "Webhook deleted",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to delete webhook",
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => wireApi.testWebhook(id),
    onSuccess: (data, id) => {
      setExpandedWebhookId(id);
      queryClient.invalidateQueries({ queryKey: ["webhookDeliveries", id] });
      toast.push({
        tone: "success",
        message: `Test delivery queued (${data.deliveryId})`,
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to send test delivery",
      });
    },
  });

  const rotateSecretMutation = useMutation({
    mutationFn: (id: string) => wireApi.rotateWebhookSecret(id),
    onSuccess: (data) => {
      setNewWebhookSecret(data.secret);
      setShowSecretModal(true);
      toast.push({
        tone: "success",
        message: "Webhook secret rotated",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to rotate webhook secret",
      });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!formData.url.trim()) {
      newErrors.url = "URL is required";
    } else if (!/^https?:\/\/.+/.test(formData.url)) {
      newErrors.url = "URL must start with http:// or https://";
    }
    
    if (formData.events.length === 0) {
      newErrors.events = "Select at least one event";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validate()) return;
    createMutation.mutate({
      name: formData.name.trim(),
      url: formData.url.trim(),
      events: formData.events,
    });
  };

  const toggleEvent = (event: string) => {
    setFormData({
      ...formData,
      events: formData.events.includes(event)
        ? formData.events.filter((e) => e !== event)
        : [...formData.events, event],
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-gray-200 rounded-2xl bg-white p-6">
          <p className="text-gray-600">Loading webhooks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">Webhooks</h3>
          <p className="text-xs text-gray-600 mt-1">
            Configure webhooks to receive real-time notifications
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
        >
          + Create Webhook
        </button>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <div className="border-2 border-gray-200 rounded-2xl bg-white p-12 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Webhooks</h3>
          <p className="text-sm text-gray-600 mb-4">Create a webhook to receive real-time event notifications.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
          >
            Create Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <motion.div
              key={webhook.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-2 border-black rounded-2xl bg-white p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">{webhook.name}</h4>
                    {webhook.active ? (
                      <Badge tone="success">Active</Badge>
                    ) : (
                      <Badge tone="danger">Inactive</Badge>
                    )}
                    {webhook.failureCount > 0 && (
                      <Badge tone="warning">{webhook.failureCount} failures</Badge>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">
                    <span className="font-mono">{webhook.url}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {webhook.events.map((event: string) => (
                      <span
                        key={event}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {event}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Created {new Date(webhook.createdAt).toLocaleDateString()}</span>
                    {webhook.lastTriggeredAt && (
                      <span>Last triggered {new Date(webhook.lastTriggeredAt).toLocaleDateString()}</span>
                    )}
                    {webhook.lastSuccessAt && (
                      <span className="text-green-600">Last success {new Date(webhook.lastSuccessAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const next = expandedWebhookId === webhook.id ? null : webhook.id;
                      setExpandedWebhookId(next);
                    }}
                    className="px-4 py-2 border-2 border-black text-black text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
                  >
                    {expandedWebhookId === webhook.id ? "Hide logs" : "Logs"}
                  </button>
                  <button
                    onClick={() => testMutation.mutate(webhook.id)}
                    disabled={testMutation.isPending}
                    className="px-4 py-2 border-2 border-gray-300 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    {testMutation.isPending ? "Testing..." : "Test"}
                  </button>
                  <button
                    onClick={() => rotateSecretMutation.mutate(webhook.id)}
                    disabled={rotateSecretMutation.isPending}
                    className="px-4 py-2 border-2 border-gray-300 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                    title="Rotate signing secret (shown once)"
                  >
                    Rotate secret
                  </button>
                  <button
                    onClick={() => {
                      updateMutation.mutate({
                        id: webhook.id,
                        data: { active: !webhook.active },
                      });
                    }}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 border-2 border-gray-300 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    {webhook.active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this webhook?")) {
                        deleteMutation.mutate(webhook.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="px-4 py-2 border-2 border-red-500 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-all disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {expandedWebhookId === webhook.id && (
                <div className="mt-5 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                      Delivery logs (latest 25)
                    </h5>
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["webhookDeliveries", webhook.id] })}
                      className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                    >
                      Refresh
                    </button>
                  </div>

                  {deliveriesQuery.isLoading ? (
                    <p className="text-xs text-gray-600">Loading deliveries…</p>
                  ) : deliveriesQuery.data?.length ? (
                    <div className="space-y-2">
                      {deliveriesQuery.data.map((d: any) => (
                        <div key={d.id} className="border border-gray-200 rounded-xl p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="font-mono text-gray-900">{d.id}</div>
                            <div className="text-gray-600">
                              {new Date(d.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {d.eventType}
                            </span>
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                              {d.status}
                            </span>
                            {typeof d.statusCode === "number" && (
                              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                                HTTP {d.statusCode}
                              </span>
                            )}
                            <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                              attempt {d.attemptNumber}
                            </span>
                            {d.nextRetryAt && (
                              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">
                                next retry {new Date(d.nextRetryAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                          {d.responseBody && (
                            <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-gray-600 bg-gray-50 rounded-lg p-2 max-h-32 overflow-auto">
                              {d.responseBody}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-600">No deliveries yet. Click “Test” to send one.</p>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border-2 border-black max-w-2xl w-full p-6 my-auto"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create Webhook</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                  Webhook Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Production Webhook"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 ${
                    errors.name ? "border-red-500" : "border-black"
                  }`}
                  disabled={createMutation.isPending}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                  Webhook URL
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  placeholder="https://your-server.com/webhooks/wire"
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 ${
                    errors.url ? "border-red-500" : "border-black"
                  }`}
                  disabled={createMutation.isPending}
                />
                {errors.url && (
                  <p className="mt-1 text-sm text-red-600">{errors.url}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Must be a valid HTTPS URL that can receive POST requests
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                  Events to Subscribe To
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 border-2 border-gray-200 rounded-xl p-4 max-h-64 overflow-y-auto">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-gray-300"
                        disabled={createMutation.isPending}
                      />
                      <span className="text-xs text-gray-700">{event}</span>
                    </label>
                  ))}
                </div>
                {errors.events && (
                  <p className="mt-1 text-sm text-red-600">{errors.events}</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Create Webhook"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({ name: "", url: "", events: [] });
                    setErrors({});
                  }}
                  disabled={createMutation.isPending}
                  className="px-6 py-3 border-2 border-black rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Secret Display Modal */}
      {showSecretModal && newWebhookSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border-2 border-black max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">⚠️ Save Your Webhook Secret</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Important:</strong> Use this secret to verify webhook signatures. Copy it now.
              </p>
            </div>
            <div className="bg-gray-100 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">Webhook Secret</label>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newWebhookSecret);
                    toast.push({
                      tone: "success",
                      message: "Secret copied to clipboard",
                    });
                  }}
                  className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                >
                  Copy
                </button>
              </div>
              <code className="text-sm font-mono text-gray-900 break-all">{newWebhookSecret}</code>
            </div>
            <button
              onClick={() => {
                setShowSecretModal(false);
                setNewWebhookSecret(null);
              }}
              className="w-full px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
            >
              I've Saved It
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
