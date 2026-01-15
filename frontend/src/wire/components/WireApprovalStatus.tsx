import React from "react";
import type { ApprovalStatus } from "../types/wire";

interface WireApprovalStatusProps {
  required: number;
  completed: number;
  approvers: Array<{
    userId: string;
    name: string;
    status: "pending" | "completed";
    completedAt: string | null;
  }>;
  currentUserId: string;
}

export function WireApprovalStatus({
  required,
  completed,
  approvers,
  currentUserId,
}: WireApprovalStatusProps) {
  const progress = required > 0 ? (completed / required) * 100 : 0;

  return (
    <div className="border-2 border-black rounded-xl bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-500">
            Approval Status
          </p>
          <h3 className="text-sm font-semibold text-gray-900 mt-0.5">Progress</h3>
        </div>
        <span className="text-xs font-bold text-gray-900">
          {completed} / {required}
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2.5 border border-gray-200">
        <div
          className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="space-y-2">
        {approvers.map((approver) => {
          const isCurrentUser = approver.userId === currentUserId;
          const isCompleted = approver.status === "completed";

          return (
            <div
              key={approver.userId}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-200 ${
                isCurrentUser
                  ? "bg-blue-50 border-blue-200 border-2"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-900">
                  {approver.name}
                  {isCurrentUser && (
                    <span className="ml-1 text-[10px] uppercase tracking-wide text-blue-600">(You)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isCompleted ? (
                  <>
                    <span className="text-emerald-600 text-base">✅</span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {approver.completedAt
                        ? new Date(approver.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ""}
                    </span>
                  </>
                ) : (
                  <span className="text-amber-600 text-base">⏳</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {completed === 0 && required === 2 && (
        <div className="text-[10px] text-gray-600 bg-blue-50 border-2 border-blue-200 rounded-xl p-3 leading-relaxed">
          <strong className="font-semibold text-blue-900">Separation of Context:</strong> Second approver will not see first approver's transcript, only intent summary and risk reasons.
        </div>
      )}
    </div>
  );
}
