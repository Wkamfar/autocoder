import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { wireApi } from "../api/client";
import { useToast } from "../../crm/ui/CrmDesignSystem";

export default function WireSettingsOrgGroupsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [memberOrgId, setMemberOrgId] = useState("");
  const [memberRole, setMemberRole] = useState("MEMBER");
  const [metrics, setMetrics] = useState<any>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await wireApi.getOrgGroups();
      setData(res);
      const defaultGroup = res?.owned?.[0]?.id || res?.memberOf?.[0]?.id || null;
      setSelectedGroupId((prev) => prev || defaultGroup);
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to load org groups" });
    } finally {
      setLoading(false);
    }
  };

  const refreshMetrics = async (groupId: string) => {
    try {
      const m = await wireApi.getOrgGroupMetrics(groupId);
      setMetrics(m);
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to load metrics" });
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedGroupId) refreshMetrics(selectedGroupId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  const createGroup = async () => {
    try {
      await wireApi.createOrgGroup(newGroupName);
      setNewGroupName("");
      toast.push({ tone: "success", message: "Org group created" });
      refresh();
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to create org group" });
    }
  };

  const addMember = async () => {
    if (!selectedGroupId) return;
    try {
      await wireApi.addOrgGroupMember(selectedGroupId, memberOrgId, memberRole);
      setMemberOrgId("");
      toast.push({ tone: "success", message: "Member added" });
      refresh();
      refreshMetrics(selectedGroupId);
    } catch (e: any) {
      toast.push({ tone: "danger", message: e?.message || "Failed to add member" });
    }
  };

  const allGroups = useMemo(() => {
    const owned = data?.owned || [];
    const memberOf = data?.memberOf || [];
    const uniq = new Map<string, any>();
    for (const g of owned) uniq.set(g.id, { ...g, kind: "owned" });
    for (const g of memberOf) uniq.set(g.id, { ...g, kind: "member" });
    return Array.from(uniq.values());
  }, [data]);

  const selectedGroup = useMemo(() => allGroups.find((g) => g.id === selectedGroupId), [allGroups, selectedGroupId]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="border-2 border-black rounded-2xl bg-white p-6">
        <h1 className="text-xl font-bold text-gray-900">Org groups (rollups)</h1>
        <p className="text-sm text-gray-600 mt-1">
          Multi-account rollups: group multiple orgs and aggregate activity.
        </p>
      </motion.div>

      <div className="border-2 border-black rounded-2xl bg-white p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Create org group</h2>
        <div className="flex gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Acme Holding Company"
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
          />
          <button onClick={createGroup} className="px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800">
            Create
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="border-2 border-black rounded-2xl bg-white p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Groups</h2>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : allGroups.length === 0 ? (
            <div className="text-sm text-gray-500">No groups yet.</div>
          ) : (
            <div className="space-y-2">
              {allGroups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`w-full text-left border rounded-xl p-3 ${
                    selectedGroupId === g.id ? "border-black bg-gray-50" : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="font-semibold text-gray-900">{g.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{g.id}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="border-2 border-black rounded-2xl bg-white p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Members</h2>
            {!selectedGroup ? (
              <div className="text-sm text-gray-500">Select a group.</div>
            ) : (
              <>
                <div className="text-xs text-gray-600 font-mono mb-4">
                  ownerOrgId={selectedGroup.ownerOrgId}
                </div>
                <div className="space-y-2 mb-4">
                  {(selectedGroup.members || []).map((m: any) => (
                    <div key={m.orgId} className="flex items-center justify-between border border-gray-200 rounded-xl p-3 bg-gray-50">
                      <div className="font-mono text-xs text-gray-700">{m.orgId}</div>
                      <div className="font-mono text-xs text-gray-700">{m.role}</div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="font-bold text-gray-900 mb-2">Add member org</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={memberOrgId}
                      onChange={(e) => setMemberOrgId(e.target.value)}
                      placeholder="org_..."
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black"
                    />
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value)}
                      className="px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-black bg-white"
                    >
                      <option value="MEMBER">MEMBER</option>
                      <option value="VIEWER">VIEWER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="OWNER">OWNER</option>
                    </select>
                    <button onClick={addMember} className="px-4 py-3 bg-black text-white rounded-xl font-semibold hover:bg-gray-800">
                      Add
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="border-2 border-black rounded-2xl bg-white p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-gray-900">Rollup metrics</h2>
              {selectedGroupId && (
                <button onClick={() => refreshMetrics(selectedGroupId)} className="px-3 py-2 border-2 border-black rounded-lg text-sm font-semibold hover:bg-gray-50">
                  Refresh
                </button>
              )}
            </div>
            {!metrics ? (
              <div className="text-sm text-gray-500 mt-3">Select a group to view metrics.</div>
            ) : (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Member orgs</div>
                  <div className="text-2xl font-bold font-mono">{metrics.memberOrgCount}</div>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Intents</div>
                  <div className="text-2xl font-bold font-mono">{metrics.intentCount}</div>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 sm:col-span-2">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Total amount (minor units)</div>
                  <div className="text-2xl font-bold font-mono">{metrics.totalAmountMinor}</div>
                  <div className="text-xs text-gray-500 mt-1">{metrics.currencyNote}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

