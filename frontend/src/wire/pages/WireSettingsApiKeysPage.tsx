import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export default function WireSettingsApiKeysPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);
  const [showSecretModal, setShowSecretModal] = useState(false);

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["apiKeys"],
    queryFn: () => wireApi.getApiKeys(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => wireApi.createApiKey({ name }),
    onSuccess: (data) => {
      setNewKeySecret(data.secret);
      setShowSecretModal(true);
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      toast.push({
        tone: "success",
        message: "API key created successfully",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to create API key",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => wireApi.revokeApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      toast.push({
        tone: "success",
        message: "API key revoked",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to revoke API key",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => wireApi.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["apiKeys"] });
      toast.push({
        tone: "success",
        message: "API key deleted",
      });
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to delete API key",
      });
    },
  });

  const handleCreate = () => {
    if (!newKeyName.trim()) {
      toast.push({
        tone: "warning",
        message: "Please enter a key name",
      });
      return;
    }
    createMutation.mutate(newKeyName.trim());
    setNewKeyName("");
    setShowCreateModal(false);
  };

  const handleCopySecret = () => {
    if (newKeySecret) {
      navigator.clipboard.writeText(newKeySecret);
      toast.push({
        tone: "success",
        message: "Secret copied to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="border-2 border-gray-200 rounded-2xl bg-white p-6">
          <p className="text-gray-600">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900">API Keys</h3>
          <p className="text-xs text-gray-600 mt-1">
            Manage your API keys for programmatic access
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
        >
          + Create API Key
        </button>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="border-2 border-gray-200 rounded-2xl bg-white p-12 text-center">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No API Keys</h3>
          <p className="text-sm text-gray-600 mb-4">Create your first API key to start integrating WIRE into your systems.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all"
          >
            Create API Key
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="border-2 border-black rounded-2xl bg-white p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">{key.name}</h4>
                    {key.revokedAt ? (
                      <Badge tone="danger">Revoked</Badge>
                    ) : key.expiresAt && new Date(key.expiresAt) < new Date() ? (
                      <Badge tone="warning">Expired</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">{key.keyPrefix}...</span>
                    </div>
                    <span className="text-gray-500">{key.permissions.length} permissions</span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
                    <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.lastUsedAt && (
                      <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                    )}
                    {key.expiresAt && (
                      <span>Expires {new Date(key.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                {!key.revokedAt && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => revokeMutation.mutate(key.id)}
                      disabled={revokeMutation.isPending}
                      className="px-4 py-2 border-2 border-red-500 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                      {revokeMutation.isPending ? "Revoking..." : "Revoke"}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
                          deleteMutation.mutate(key.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="px-4 py-2 border-2 border-gray-300 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border-2 border-black max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">Create API Key</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-2">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API Key"
                  className="w-full px-4 py-3 border-2 border-black rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
                />
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ Make sure to copy your API key immediately. You won't be able to see it again.
                </p>
              </div>
              <div className="flex items-center gap-3 pt-4">
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 px-6 py-3 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50"
                >
                  {createMutation.isPending ? "Creating..." : "Create Key"}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewKeyName("");
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
      {showSecretModal && newKeySecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border-2 border-black max-w-md w-full p-6"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-4">⚠️ Save Your API Secret</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-yellow-800 mb-2">
                <strong>Important:</strong> Copy this secret now. You won't be able to see it again.
              </p>
            </div>
            <div className="bg-gray-100 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-700">API Secret</label>
                <button
                  onClick={handleCopySecret}
                  className="text-xs text-gray-600 hover:text-gray-900 font-medium"
                >
                  Copy
                </button>
              </div>
              <code className="text-sm font-mono text-gray-900 break-all">{newKeySecret}</code>
            </div>
            <button
              onClick={() => {
                setShowSecretModal(false);
                setNewKeySecret(null);
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
