import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './contexts/ThemeContext'
import { AuthProvider } from './wire/contexts/AuthContext'
import { ErrorBoundary } from './wire/components/ErrorBoundary'
import WirePage from './wire/pages/WirePage'
import WireIntentsPage from './wire/pages/WireIntentsPage'
import WireIntentDetailPage from './wire/pages/WireIntentDetailPage'
import WireBeneficiariesPage from './wire/pages/WireBeneficiariesPage'
import WireBeneficiaryIntelligencePage from './wire/pages/WireBeneficiaryIntelligencePage'
import WireEvidencePage from './wire/pages/WireEvidencePage'
import WirePoliciesPage from './wire/pages/WirePoliciesPage'
import WireDevPage from './wire/pages/WireDevPage'
import WireLogPage from './wire/pages/WireLogPage'
import WireAdminDashboardPage from './wire/pages/WireAdminDashboardPage'
import WireRequestPaymentPage from './wire/pages/WireRequestPaymentPage'
import WireRequestQueuePage from './wire/pages/WireRequestQueuePage'
import WireApprovalsPage from './wire/pages/WireApprovalsPage'
import WireCompliancePage from './wire/pages/WireCompliancePage'
import WireUserSettingsPage from './wire/pages/WireUserSettingsPage'
import WireSettingsOverviewPage from './wire/pages/WireSettingsOverviewPage'
import WireSettingsProfilePage from './wire/pages/WireSettingsProfilePage'
import WireSettingsAccountsPage from './wire/pages/WireSettingsAccountsPage'
import WireSettingsSecurityPage from './wire/pages/WireSettingsSecurityPage'
import WireSettingsSecurityHistoryPage from './wire/pages/WireSettingsSecurityHistoryPage'
import WireSettingsNotificationsPage from './wire/pages/WireSettingsNotificationsPage'
import WireSettingsApiKeysPage from './wire/pages/WireSettingsApiKeysPage'
import WireWebhooksPage from './wire/pages/WireWebhooksPage'
import WireSettingsDomainsPage from './wire/pages/WireSettingsDomainsPage'
import WireSettingsAdvancedPage from './wire/pages/WireSettingsAdvancedPage'
import WireSettingsPoliciesPage from './wire/pages/WireSettingsPoliciesPage'
import WireSettingsHelpPage from './wire/pages/WireSettingsHelpPage'
import WireSettingsOrgGroupsPage from './wire/pages/WireSettingsOrgGroupsPage'
import WireSettingsSSOPage from './wire/pages/WireSettingsSSOPage'
import WireSignupPage from './wire/pages/WireSignupPage'
import WireLoginPage from './wire/pages/WireLoginPage'
import WireForgotPasswordPage from './wire/pages/WireForgotPasswordPage'
import WireResetPasswordPage from './wire/pages/WireResetPasswordPage'
import WireInviteAcceptPage from './wire/pages/WireInviteAcceptPage'
import WireMagicLinkPage from './wire/pages/WireMagicLinkPage'
import WireVoiceOnboardingPage from "./wire/pages/WireVoiceOnboardingPage"
import WirePublicIntentNewPage from './wire/pages/WirePublicIntentNewPage'
import WirePublicIntentViewPage from './wire/pages/WirePublicIntentViewPage'
import WireFastWireTestPage from './wire/pages/WireFastWireTestPage'
import WireOidcCallbackPage from "./wire/pages/WireOidcCallbackPage"
import WireBeneficiaryConfirmPage from './wire/pages/WireBeneficiaryConfirmPage'
import './index.css'
import './styles/pose.css'
import { ApiModeIndicator } from './wire/components/ApiModeIndicator'
import { ToastProvider } from './crm/ui/CrmDesignSystem'

const queryClient = new QueryClient()

function WireApp() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ApiModeIndicator />
          <Routes>
          <Route path="/login" element={<WireLoginPage />} />
          <Route path="/oidc/callback" element={<WireOidcCallbackPage />} />
          <Route path="/forgot-password" element={<WireForgotPasswordPage />} />
          <Route path="/reset-password" element={<WireResetPasswordPage />} />
          <Route path="/signup" element={<WireSignupPage />} />
          <Route path="/magic" element={<WireMagicLinkPage />} />
          <Route path="/onboarding/voice" element={<WireVoiceOnboardingPage />} />
          <Route path="/invite/:token" element={<WireInviteAcceptPage />} />
          <Route path="/public/intents/new" element={<WirePublicIntentNewPage />} />
          <Route path="/public/intents/:id" element={<WirePublicIntentViewPage />} />
          <Route path="/test" element={<WireFastWireTestPage />} />
          <Route path="/beneficiaries/confirm" element={<WireBeneficiaryConfirmPage />} />
          <Route path="/" element={<WirePage />}>
            <Route index element={<WireIntentsPage />} />
            <Route path="admin" element={<WireAdminDashboardPage />} />
            <Route path="intents" element={<WireIntentsPage />} />
            <Route path="intents/:id" element={<WireIntentDetailPage />} />
            <Route path="approvals" element={<WireApprovalsPage />} />
            <Route path="beneficiaries" element={<WireBeneficiariesPage />} />
            <Route path="beneficiaries/:id" element={<WireBeneficiaryIntelligencePage />} />
            <Route path="requests" element={<WireRequestQueuePage />} />
            <Route path="requests/new" element={<WireRequestPaymentPage />} />
            <Route path="compliance" element={<WireCompliancePage />} />
            <Route path="evidence/:intentId" element={<WireEvidencePage />} />
            <Route path="policies" element={<WirePoliciesPage />} />
            <Route path="help" element={<WireSettingsHelpPage />} />
            <Route path="dev" element={<WireDevPage />} />
            <Route path="log" element={<WireLogPage />} />
            <Route path="settings" element={<WireUserSettingsPage />}>
              <Route index element={<WireSettingsOverviewPage />} />
              <Route path="overview" element={<WireSettingsOverviewPage />} />
              <Route path="profile" element={<WireSettingsProfilePage />} />
              <Route path="accounts" element={<WireSettingsAccountsPage />} />
              <Route path="security" element={<WireSettingsSecurityPage />} />
              <Route path="security-history" element={<WireSettingsSecurityHistoryPage />} />
              <Route path="notifications" element={<WireSettingsNotificationsPage />} />
              <Route path="policies" element={<WireSettingsPoliciesPage />} />
              <Route path="api-keys" element={<WireSettingsApiKeysPage />} />
              <Route path="webhooks" element={<WireWebhooksPage />} />
              <Route path="domains" element={<WireSettingsDomainsPage />} />
              <Route path="org-groups" element={<WireSettingsOrgGroupsPage />} />
              <Route path="sso" element={<WireSettingsSSOPage />} />
              <Route path="advanced" element={<WireSettingsAdvancedPage />} />
              <Route path="help" element={<Navigate to="/help" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/v2/" replace />} />
        </Routes>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/v2">
      <WireApp />
    </BrowserRouter>
  </React.StrictMode>,
)
