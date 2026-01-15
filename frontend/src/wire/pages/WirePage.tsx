import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";
import { ToastProvider, CommandPaletteProvider } from "../../crm/ui/CrmDesignSystem";
import { WireServiceHealth } from "../components/WireServiceHealth";
import { WireNotificationCenter } from "../components/WireNotificationCenter";
import { useServiceHealth } from "../hooks/useWireIntents";
import { useAuth } from "../contexts/AuthContext";
import { WireSetupWizard } from "../components/WireSetupWizard";
import { WireSenderOnboarding } from "../components/WireSenderOnboarding";
import { WireBrand } from "../ui/WireBrand";

const TAB_CONFIG = [
  {
    id: "admin",
    path: "/admin",
    label: "Admin",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: "intents",
    path: "/intents",
    label: "Intents",
    title: "Money you are sending",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "approvals",
    path: "/approvals",
    label: "Approvals",
    title: "Intents requiring your approval",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "beneficiaries",
    path: "/beneficiaries",
    label: "Beneficiaries",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    id: "requests",
    path: "/requests",
    label: "Requests",
    title: "Money you are asking for",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "help",
    path: "/help",
    label: "Help",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function WirePage() {
  const { setTheme } = useTheme();
  const { data: health } = useServiceHealth();
  const { user, organization, isLoading: authLoading, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showSenderOnboarding, setShowSenderOnboarding] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  React.useEffect(() => {
    setTheme("white");
  }, [setTheme]);

  // Production auth gate: require a real session token + user.
  useEffect(() => {
    if (authLoading) return;
    const token = localStorage.getItem("wire_auth_token");
    if (!token || !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  // Close user menu when clicking outside
  useEffect(() => {
    if (!showUserMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('[data-user-menu]')) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserMenu]);

  // Check if setup is needed (for demo, check localStorage)
  useEffect(() => {
    if (!user || authLoading) return;
    
    const setupComplete = localStorage.getItem("wire_setup_complete");
    const senderOnboardingComplete = localStorage.getItem("wire_sender_onboarding_complete");
    
    // Show setup wizard if not completed
    if (!setupComplete && user.role === "ADMIN") {
      setShowSetupWizard(true);
    } else if (!senderOnboardingComplete && user.role === "TREASURY_INITIATOR") {
      setShowSenderOnboarding(true);
    }
  }, [user, authLoading]);

  const currentTab = TAB_CONFIG.find((t) => {
    if (location.pathname === t.path) return true;
    // Check if we're on the root path (which shows intents)
    if (location.pathname === "/" && t.path === "/intents") return true;
    // Help is a first-class page in production.
    if (t.id === "help" && location.pathname.startsWith("/help")) return true;
    return false;
  });

  // While auth is loading, avoid flashing app chrome.
  if (authLoading) {
    return <div className="min-h-screen bg-white" />;
  }
  if (!user) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <ToastProvider>
      <CommandPaletteProvider>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white text-black">
          {/* Top navigation bar */}
          <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center justify-between h-16">
                {/* Logo & Title */}
                <div className="flex items-center gap-4">
                  <WireBrand size="sm" />
                  <span className="text-xs text-gray-400 font-mono">
                    {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                
                {/* Tab navigation */}
                <nav className="flex items-center gap-1 bg-gray-100/80 rounded-xl p-1">
                  {TAB_CONFIG.map((t) => (
                    <NavLink
                      key={t.id}
                      to={t.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-white text-black shadow-sm"
                            : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                        }`
                      }
                    >
                      <span className={currentTab?.id === t.id ? "text-black" : "text-gray-400"}>
                        {t.icon}
                      </span>
                      <span>{t.label}</span>
                    </NavLink>
                  ))}
                </nav>
                
                {/* Right side controls */}
                <div className="flex items-center gap-2">
                  {/* Notifications */}
                  <button
                    onClick={() => setShowNotifications(true)}
                    className="relative w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition-all"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                  
                  {/* User menu */}
                  {user && (
                    <div className="relative" data-user-menu>
                      <button
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-all cursor-pointer"
                      >
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white text-[10px] font-bold">
                          {user.name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                        <div className="text-xs text-left">
                          <div className="font-medium text-gray-900">{user.name}</div>
                          <div className="text-gray-500 text-[10px]">{user.role}</div>
                        </div>
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                          <NavLink
                            to="/settings/overview"
                            onClick={() => setShowUserMenu(false)}
                            className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                          </NavLink>
                          <button
                            onClick={async () => {
                              setShowUserMenu(false);
                              await logout();
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            Sign Out
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile Navigation */}
              <div className="md:hidden flex items-center justify-between h-16">
                <div className="flex items-center gap-2">
                  <WireBrand size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowNotifications(true)}
                    className="relative w-11 h-11 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition-all"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="w-11 h-11 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 flex items-center justify-center transition-all"
                  >
                    {mobileMenuOpen ? (
                      <svg className="w-6 h-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Mobile Menu */}
              {mobileMenuOpen && (
                <div className="md:hidden border-t border-gray-200 bg-white">
                  <nav className="py-2">
                    {TAB_CONFIG.map((t) => (
                      <NavLink
                        key={t.id}
                        to={t.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-4 py-3 text-base font-medium transition-all ${
                            isActive
                              ? "bg-gray-100 text-black"
                              : "text-gray-600 hover:bg-gray-50"
                          }`
                        }
                      >
                        <span className={currentTab?.id === t.id ? "text-black" : "text-gray-400"}>
                          {t.icon}
                        </span>
                        <span>{t.label}</span>
                      </NavLink>
                    ))}
                    <NavLink
                      to="/settings/overview"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 border-t border-gray-200 mt-2"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Settings</span>
                    </NavLink>
                    <button
                      onClick={async () => {
                        setMobileMenuOpen(false);
                        await logout();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 border-t border-gray-200"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>

          {/* Service Health Banner */}
          {health && <WireServiceHealth health={health} />}

          {/* Main Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
            <Outlet />
          </div>

          {/* Notification Center */}
          <WireNotificationCenter
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
          />
        </div>

        {/* Setup Wizard */}
        {showSetupWizard && (
          <WireSetupWizard
            onComplete={() => {
              setShowSetupWizard(false);
              localStorage.setItem("wire_setup_complete", "true");
            }}
          />
        )}

        {/* Sender Onboarding */}
        {showSenderOnboarding && (
          <WireSenderOnboarding
            onComplete={() => {
              setShowSenderOnboarding(false);
              localStorage.setItem("wire_sender_onboarding_complete", "true");
            }}
          />
        )}
      </CommandPaletteProvider>
    </ToastProvider>
  );
}
