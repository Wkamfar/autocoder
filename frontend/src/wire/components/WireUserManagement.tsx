import React, { useState, useMemo } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";
import { Badge } from "../../crm/ui/CrmDesignSystem";
import type { OrgUser, UserRole } from "../types/wire";
import { AnimatePresence, motion } from "framer-motion";

const ROLE_COLORS: Record<UserRole, string> = {
  ADMIN: "bg-red-50 text-red-700 border-red-200",
  TREASURY_INITIATOR: "bg-blue-50 text-blue-700 border-blue-200",
  APPROVER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  AUDITOR: "bg-purple-50 text-purple-700 border-purple-200",
  READ_ONLY: "bg-gray-50 text-gray-700 border-gray-200",
};

export function WireUserManagement() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => api.getAllUsers(),
  });

  const createUserMutation = useMutation({
    mutationFn: (data: { name: string; email: string; role: string }) =>
      api.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      toast.push({
        tone: "success",
        message: "User created successfully",
      });
      setShowCreateModal(false);
    },
    onError: () => {
      toast.push({
        tone: "danger",
        message: "Failed to create user",
      });
    },
  });

  const inviteUserMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      wireApi.createInvitation(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      toast.push({
        tone: "success",
        message: `Invitation sent to ${data.email}`,
      });
      setShowInviteModal(false);
    },
    onError: (error: any) => {
      toast.push({
        tone: "danger",
        message: error.message || "Failed to send invitation",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      toast.push({
        tone: "success",
        message: "User role updated",
      });
      setSelectedUser(null);
    },
    onError: () => {
      toast.push({
        tone: "danger",
        message: "Failed to update role",
      });
    },
  });

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const usersByRole = useMemo(() => {
    if (!users) return {} as Record<UserRole, number>;
    return users.reduce((acc, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>);
  }, [users]);

  if (isLoading) {
    return (
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <div className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-48" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden">
        <header className="border-b border-gray-100 px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">User Management</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {users?.length || 0} total users • {users?.filter((u) => u.voiceEnrolled).length || 0} voice enrolled
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-3 sm:py-2 border-2 border-black text-black text-sm font-medium rounded-lg hover:bg-gray-50 transition-all duration-150 active:scale-95 min-h-[44px] sm:min-h-0"
            >
              + Invite User
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-3 sm:py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all duration-150 active:scale-95 min-h-[44px] sm:min-h-0"
            >
              + Create User
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {/* Search */}
          <div className="mb-6">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users by name, email, or role..."
              className="w-full px-4 py-3 sm:py-2.5 border-2 border-gray-200 rounded-xl text-base sm:text-sm focus:outline-none focus:border-black transition-colors min-h-[44px] sm:min-h-0"
            />
          </div>

          {/* Role Distribution */}
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Object.entries(usersByRole).map(([role, count]: [string, number]) => (
              <div
                key={role}
                className="border border-gray-200 rounded-xl p-3 sm:p-3 bg-gray-50 text-center"
              >
                <p className="text-xl sm:text-2xl font-bold font-mono">{count}</p>
                <p className="text-[10px] sm:text-[10px] text-gray-600 mt-1 uppercase tracking-wide break-words">
                  {role.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>

          {/* User List */}
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <p className="text-sm font-medium">No users found</p>
                <p className="text-xs text-gray-400 mt-1">
                  {searchQuery ? "Try a different search term" : "Create your first user"}
                </p>
              </div>
            ) : (
              filteredUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 cursor-pointer gap-3 sm:gap-4"
                  onClick={() => setSelectedUser(user)}
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 sm:w-10 sm:h-10 rounded-full bg-black flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-sm font-semibold text-gray-900 truncate">
                        {user.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                      <Badge
                        tone={
                          user.role === "ADMIN"
                            ? "danger"
                            : user.role === "APPROVER"
                              ? "success"
                              : user.role === "AUDITOR"
                                ? "purple"
                                : "info"
                        }
                        className="text-[10px] sm:text-xs whitespace-nowrap"
                      >
                        {user.role.replace("_", " ")}
                      </Badge>
                      {user.voiceEnrolled ? (
                        <div className="flex items-center gap-1 text-emerald-600 flex-shrink-0">
                          <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-xs font-medium whitespace-nowrap">Enrolled</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-amber-600 flex-shrink-0">
                          <svg
                            className="w-4 h-4 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <span className="text-xs font-medium whitespace-nowrap">Pending</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <svg
                    className="w-5 h-5 text-gray-400 flex-shrink-0 self-end sm:self-center"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateUserModal
            onClose={() => setShowCreateModal(false)}
            onCreate={(data) => createUserMutation.mutate(data)}
            isLoading={createUserMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* Invite User Modal */}
      <AnimatePresence>
        {showInviteModal && (
          <InviteUserModal
            onClose={() => setShowInviteModal(false)}
            onInvite={(data) => inviteUserMutation.mutate(data)}
            isLoading={inviteUserMutation.isPending}
          />
        )}
      </AnimatePresence>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onUpdateRole={(role) =>
              updateRoleMutation.mutate({ userId: selectedUser.id, role })
            }
            isLoading={updateRoleMutation.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function CreateUserModal({
  onClose,
  onCreate,
  isLoading,
}: {
  onClose: () => void;
  onCreate: (data: { name: string; email: string; role: string }) => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("TREASURY_INITIATOR");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      onCreate({ name: name.trim(), email: email.trim(), role });
      setName("");
      setEmail("");
      setRole("TREASURY_INITIATOR");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border-2 border-black bg-white shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Create New User</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@acme.com"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors bg-white"
            >
              <option value="TREASURY_INITIATOR">Treasury Initiator</option>
              <option value="APPROVER">Approver</option>
              <option value="ADMIN">Admin</option>
              <option value="AUDITOR">Auditor</option>
              <option value="READ_ONLY">Read Only</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim() || !email.trim()}
              className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
            >
              {isLoading ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function InviteUserModal({
  onClose,
  onInvite,
  isLoading,
}: {
  onClose: () => void;
  onInvite: (data: { email: string; role: string }) => void;
  isLoading: boolean;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("TREASURY_INITIATOR");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      onInvite({ email: email.trim(), role });
      setEmail("");
      setRole("TREASURY_INITIATOR");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-md rounded-2xl border-2 border-black bg-white shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Invite User</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@acme.com"
              required
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              An invitation email will be sent to this address
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors bg-white"
            >
              <option value="TREASURY_INITIATOR">Treasury Initiator</option>
              <option value="APPROVER">Approver</option>
              <option value="ADMIN">Admin</option>
              <option value="AUDITOR">Auditor</option>
              <option value="READ_ONLY">Read Only</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
            >
              {isLoading ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function UserDetailModal({
  user,
  onClose,
  onUpdateRole,
  isLoading,
}: {
  user: OrgUser;
  onClose: () => void;
  onUpdateRole: (role: string) => void;
  isLoading: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-lg rounded-2xl border-2 border-black bg-white shadow-2xl"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">User Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-white font-bold text-xl">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Role
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-black transition-colors bg-white"
              >
                <option value="TREASURY_INITIATOR">Treasury Initiator</option>
                <option value="APPROVER">Approver</option>
                <option value="ADMIN">Admin</option>
                <option value="AUDITOR">Auditor</option>
                <option value="READ_ONLY">Read Only</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">
                  Voice Enrollment
                </p>
                <p className="text-sm font-semibold">
                  {user.voiceEnrolled ? (
                    <span className="text-emerald-600">Enrolled</span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </p>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-1">
                  Last Activity
                </p>
                <p className="text-sm font-semibold">
                  {user.lastActivityAt
                    ? new Date(user.lastActivityAt).toLocaleDateString()
                    : "Never"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onUpdateRole(selectedRole)}
              disabled={isLoading || selectedRole === user.role}
              className="flex-1 px-4 py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95"
            >
              {isLoading ? "Updating..." : "Update Role"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
