import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../contexts/AuthContext";

type SettingsTab =
  | "overview"
  | "profile"
  | "accounts"
  | "security"
  | "security-history"
  | "org-groups"
  | "sso"
  | "notifications"
  | "policies"
  | "api-keys"
  | "webhooks"
  | "domains"
  | "advanced";

const SETTINGS_TABS: Array<{
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  path: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    path: "/settings/overview",
  },
  {
    id: "profile",
    label: "Profile",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    path: "/settings/profile",
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
    path: "/settings/accounts",
  },
  {
    id: "security",
    label: "Security",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    path: "/settings/security",
  },
  {
    id: "security-history",
    label: "Security history",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    path: "/settings/security-history",
  },
  {
    id: "org-groups",
    label: "Org groups",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    path: "/settings/org-groups",
  },
  {
    id: "sso",
    label: "SSO",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12a9 9 0 0115.364-6.364M21 12a9 9 0 01-15.364 6.364" />
      </svg>
    ),
    path: "/settings/sso",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    path: "/settings/notifications",
  },
  {
    id: "policies",
    label: "Policies",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    path: "/settings/policies",
  },
  {
    id: "api-keys",
    label: "API Keys",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    path: "/settings/api-keys",
  },
  {
    id: "webhooks",
    label: "Webhooks",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
    path: "/settings/webhooks",
  },
  {
    id: "domains",
    label: "Domains",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21c4.418 0 8-4.03 8-9s-3.582-9-8-9-8 4.03-8 9 3.582 9 8 9zm0 0c2.21 0 4-4.03 4-9s-1.79-9-4-9-4 4.03-4 9 1.79 9 4 9zm-7-9h14" />
      </svg>
    ),
    path: "/settings/domains",
  },
  {
    id: "advanced",
    label: "Advanced",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    path: "/settings/advanced",
  },
];

export default function WireUserSettingsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const currentTab = SETTINGS_TABS.find((tab) => location.pathname === tab.path || location.pathname.startsWith(tab.path + "/") || (tab.path === "/settings/overview" && location.pathname === "/settings"));

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-2 border-black rounded-2xl bg-white flex flex-col overflow-hidden"
      >
        <header className="border-b border-gray-100 px-6 py-4 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">User Settings</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Manage your account, security, and preferences
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-xs font-bold">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="text-xs">
                  <div className="font-medium text-gray-900">{user?.name || "User"}</div>
                  <div className="text-gray-500 text-[10px]">{user?.role || "UNKNOWN"}</div>
                </div>
              </div>
            </div>
          </div>
        </header>
      </motion.div>

      {/* Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Mobile: compact top nav (keeps content space) */}
        <nav className="md:hidden border-2 border-black rounded-2xl bg-white p-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            {SETTINGS_TABS.map((tab) => {
              const isActive = currentTab?.id === tab.id;
              return (
                <NavLink
                  key={tab.id}
                  to={tab.path}
                  className={() =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      isActive ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
                    }`
                  }
                >
                  <span className={isActive ? "text-white" : "text-gray-400"}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        {/* Desktop: left sidebar nav */}
        <aside className="hidden md:block md:col-span-3 lg:col-span-3">
          <div className="border-2 border-black rounded-2xl bg-white p-3 sticky top-20 max-h-[calc(100vh-6rem)] overflow-auto">
            <div className="px-2 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
                Navigation
              </div>
            </div>
            <nav className="space-y-1">
              {SETTINGS_TABS.map((tab) => {
                const isActive = currentTab?.id === tab.id;
                return (
                  <NavLink
                    key={tab.id}
                    to={tab.path}
                    className={() =>
                      `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? "bg-black text-white shadow-sm"
                          : "text-gray-700 hover:bg-gray-100"
                      }`
                    }
                  >
                    <span className={isActive ? "text-white" : "text-gray-400"}>{tab.icon}</span>
                    <span className="truncate">{tab.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="md:col-span-9 lg:col-span-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
