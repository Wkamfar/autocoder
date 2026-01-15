import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './contexts/ThemeContext'
import WirePage from './wire/pages/WirePage'
import WireIntentsPage from './wire/pages/WireIntentsPage'
import WireIntentDetailPage from './wire/pages/WireIntentDetailPage'
import WireBeneficiariesPage from './wire/pages/WireBeneficiariesPage'
import WireBeneficiaryIntelligencePage from './wire/pages/WireBeneficiaryIntelligencePage'
import WireEvidencePage from './wire/pages/WireEvidencePage'
import WirePoliciesPage from './wire/pages/WirePoliciesPage'
import WireDevPage from './wire/pages/WireDevPage'
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
import WireSettingsNotificationsPage from './wire/pages/WireSettingsNotificationsPage'
import WireSettingsApiKeysPage from './wire/pages/WireSettingsApiKeysPage'
import WireSettingsAdvancedPage from './wire/pages/WireSettingsAdvancedPage'
import WireSettingsPoliciesPage from './wire/pages/WireSettingsPoliciesPage'
import WireSettingsHelpPage from './wire/pages/WireSettingsHelpPage'
import './index.css'
import './styles/pose.css'

const queryClient = new QueryClient()

function WireApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Routes>
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
            <Route path="dev" element={<WireDevPage />} />
            <Route path="settings" element={<WireUserSettingsPage />}>
              <Route index element={<WireSettingsOverviewPage />} />
              <Route path="overview" element={<WireSettingsOverviewPage />} />
              <Route path="profile" element={<WireSettingsProfilePage />} />
              <Route path="accounts" element={<WireSettingsAccountsPage />} />
              <Route path="security" element={<WireSettingsSecurityPage />} />
              <Route path="notifications" element={<WireSettingsNotificationsPage />} />
              <Route path="policies" element={<WireSettingsPoliciesPage />} />
              <Route path="api-keys" element={<WireSettingsApiKeysPage />} />
              <Route path="advanced" element={<WireSettingsAdvancedPage />} />
              <Route path="help" element={<WireSettingsHelpPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WireApp />
    </BrowserRouter>
  </React.StrictMode>,
)
