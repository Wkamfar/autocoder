import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

export interface CrmUserListItem {
  id: string;
  name: string;
  email: string;
  status: string;
  role: { name: string };
}

export interface OwnerAssignmentModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (ownerId: string) => void;
  users: CrmUserListItem[];
  investorCount: number;
  onCreateUser?: (name: string, email: string) => Promise<void>;
  canCreateUsers?: boolean;
}

export function OwnerAssignmentModal({
  open,
  onClose,
  onConfirm,
  users,
  investorCount,
  onCreateUser,
  canCreateUsers = false,
}: OwnerAssignmentModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role?.name?.toLowerCase().includes(query),
    );
  }, [users, searchQuery]);

  useEffect(() => {
    if (!open) return;
    setSearchQuery("");
    setSelectedUserId(null);
    setHighlightedIndex(0);
    setShowCreateUser(false);
    setNewUserName("");
    setNewUserEmail("");
  }, [open]);

  const handleCreateUser = async () => {
    if (!onCreateUser || !newUserName.trim() || !newUserEmail.trim()) return;
    setIsCreating(true);
    try {
      await onCreateUser(newUserName.trim(), newUserEmail.trim());
      setShowCreateUser(false);
      setNewUserName("");
      setNewUserEmail("");
    } catch (error) {
      // Error handling is done in parent
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          Math.min(prev + 1, Math.max(0, filteredUsers.length - 1)),
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === "Enter") {
        const user = filteredUsers[highlightedIndex];
        if (!user) return;
        setSelectedUserId(user.id);
        onConfirm(user.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredUsers, highlightedIndex, onClose, onConfirm]);

  const handleConfirm = () => {
    if (selectedUserId) {
      onConfirm(selectedUserId);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.98, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-2 border-black rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
          >
            <div className="sticky top-0 bg-white border-b-2 border-black px-6 py-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-tight text-black">
                  Assign owner
                </h2>
                <p className="text-[11px] text-gray-600 mt-1">
                  {investorCount === 1 
                    ? "Select the accountable operator for this opportunity."
                    : `Select the accountable operator for ${investorCount} investors.`}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-black w-9 h-9 hover:bg-black hover:text-white"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 space-y-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder="Search by name, email, or role…"
                className="w-full px-4 py-2 border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black/20 text-sm"
                autoFocus={!showCreateUser}
              />
              {canCreateUsers && !showCreateUser && (
                <button
                  type="button"
                  onClick={() => setShowCreateUser(true)}
                  className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800"
                >
                  + Create New User
                </button>
              )}
              {showCreateUser && (
                <div className="border-2 border-blue-500 rounded-xl p-3 space-y-2 bg-blue-50">
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Name (e.g., JOHN DOE)"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newUserName.trim() && newUserEmail.trim()) {
                        handleCreateUser();
                      }
                      if (e.key === "Escape") {
                        setShowCreateUser(false);
                      }
                    }}
                  />
                  <input
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Email (e.g., john@pose.xyz)"
                    className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newUserName.trim() && newUserEmail.trim()) {
                        handleCreateUser();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateUser}
                      disabled={!newUserName.trim() || !newUserEmail.trim() || isCreating}
                      className="flex-1 px-3 py-1.5 bg-black text-white rounded text-xs font-semibold disabled:opacity-50"
                    >
                      {isCreating ? "Creating..." : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateUser(false);
                        setNewUserName("");
                        setNewUserEmail("");
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2">
              {filteredUsers.length === 0 ? (
                <div className="px-4 py-10 text-center text-gray-500 text-sm">
                  No users match “{searchQuery}”.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((user, index) => {
                    const isHighlighted = index === highlightedIndex;
                    const isSelected = user.id === selectedUserId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`w-full text-left px-4 py-3 rounded-xl transition-colors border-2 flex items-center justify-between gap-3 ${
                          isSelected
                            ? "bg-black text-white border-black"
                            : isHighlighted
                              ? "bg-gray-50 border-gray-300"
                              : "bg-white border-transparent hover:bg-gray-50 hover:border-gray-200"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">
                            {user.name}
                          </div>
                          <div
                            className={`text-[11px] truncate font-mono ${
                              isSelected ? "text-gray-300" : "text-gray-600"
                            }`}
                          >
                            {user.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap border ${
                              isSelected
                                ? "bg-white/10 text-white border-white/20"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                            }`}
                          >
                            {user.role?.name || "no role"}
                          </span>
                          {user.status === "inactive" && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold whitespace-nowrap border ${
                                isSelected
                                  ? "bg-red-500/20 text-red-200 border-red-400/30"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              inactive
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t-2 border-black px-6 py-4 flex items-center justify-between gap-3">
              <p className="text-[10px] text-gray-500">
                Tips: ↑/↓ to navigate · Enter to confirm · Esc to close
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-black px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-black hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!selectedUserId}
                  className="rounded-full bg-black px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirm
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
