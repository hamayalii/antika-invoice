import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./components/RequireAuth";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UsersPage } from "./pages/UsersPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { InvoiceEditorPage } from "./pages/InvoiceEditorPage";
import { InvoicePrintPage } from "./pages/InvoicePrintPage";
import { VouchersPage } from "./pages/VouchersPage";
import { VoucherEditorPage } from "./pages/VoucherEditorPage";
import { VoucherPrintPage } from "./pages/VoucherPrintPage";
import { VerifyPage } from "./pages/VerifyPage";
import { NumberGapsPage } from "./pages/NumberGapsPage";
import { HelpPage } from "./pages/HelpPage";
import { CalibrationPrintPage } from "./pages/CalibrationPrintPage";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/verify/:code" element={<VerifyPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/print/invoice/:id" element={<InvoicePrintPage />} />
        <Route path="/print/voucher/:id" element={<VoucherPrintPage />} />
        <Route path="/print/calibration" element={<CalibrationPrintPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="invoices/new" element={<InvoiceEditorPage />} />
          <Route path="invoices/:id/edit" element={<InvoiceEditorPage />} />
          <Route path="vouchers" element={<VouchersPage />} />
          <Route path="vouchers/new" element={<VoucherEditorPage />} />
          <Route path="vouchers/:id/edit" element={<VoucherEditorPage />} />
          <Route path="reports/number-gaps" element={<NumberGapsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
