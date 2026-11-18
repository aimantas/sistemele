import { createBrowserRouter, Link } from "react-router";
import { clientModules } from "@/modules/client";
import { AppShell } from "./shell/AppShell";
import { BrandSettingsPage } from "./pages/BrandSettingsPage";
import { LoginPage, VerifyPage } from "./pages/LoginPage";
import { ApiSettingsPage, AuditSettingsPage, BusinessSettingsPage, EmailSettingsPage, ModulesSettingsPage, SettingsLayout, TeamSettingsPage } from "./pages/SettingsPages";
import { buttonClass } from "./ui";

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-ink-soft">This screen does not exist or its module is switched off.</p>
      <Link className={buttonClass("primary", "md", "mt-6")} to="/app">
        Back to the dashboard
      </Link>
    </div>
  );
}

/** Dashboard routes. Modules add theirs through `routes` in their client module. */
export const router = createBrowserRouter([
  { path: "/app/login", element: <LoginPage /> },
  { path: "/app/login/verify", element: <VerifyPage /> },
  {
    path: "/app",
    element: <AppShell />,
    children: [
      { index: true, lazy: () => import("./dashboard/DashboardPage").then((m) => ({ Component: m.default })) },
      {
        path: "settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <BusinessSettingsPage /> },
          { path: "brand", element: <BrandSettingsPage /> },
          { path: "team", element: <TeamSettingsPage /> },
          { path: "api", element: <ApiSettingsPage /> },
          { path: "email", element: <EmailSettingsPage /> },
          { path: "audit", element: <AuditSettingsPage /> },
          { path: "modules", element: <ModulesSettingsPage /> },
        ],
      },
      ...clientModules.flatMap((module) => module.routes),
      { path: "*", element: <NotFound /> },
    ],
  },
]);
