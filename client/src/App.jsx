import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthPage } from './AuthPages.jsx';
import { DashboardPage, IntegrationPage, OrdersPage, PaymentsPage, SettingsPage, UnmatchedPage } from './MerchantPages.jsx';
import { PrivateArea } from './MerchantShell.jsx';
import PayCheckout from './PayCheckout.jsx';
import PrivacyPage from './PrivacyPage.jsx';
import { hasSession } from './api.js';

export default function App() {
  return (
    <Routes>
      <Route path="/pay/:orderId" element={<PayCheckout />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route element={<PrivateArea />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/unmatched" element={<UnmatchedPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/integration" element={<IntegrationPage />} />
      </Route>
      <Route path="/" element={<Navigate to={hasSession() ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={hasSession() ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
