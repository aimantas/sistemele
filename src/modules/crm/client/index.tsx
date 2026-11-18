import { KanbanSquare, ListTodo, UserPlus, Users } from "lucide-react";
import { lazy } from "react";
import type { ClientModule } from "@/modules/types.client";

/**
 * CRM, browser side. Pages are lazy routes so each module only loads when used.
 * Copy this file's shape when you build a new module.
 */
export const crmClient: ClientModule = {
  id: "crm",
  name: "CRM",
  nav: [
    { to: "/app/crm/contacts", label: "Contacts", icon: Users },
    { to: "/app/crm/pipeline", label: "Pipeline", icon: KanbanSquare },
    { to: "/app/crm/tasks", label: "Tasks", icon: ListTodo },
  ],
  routes: [
    { path: "crm/contacts", lazy: () => import("./ContactsPage").then((m) => ({ Component: m.default })) },
    { path: "crm/contacts/:id", lazy: () => import("./ContactDetailPage").then((m) => ({ Component: m.default })) },
    { path: "crm/pipeline", lazy: () => import("./PipelinePage").then((m) => ({ Component: m.default })) },
    { path: "crm/tasks", lazy: () => import("./TasksPage").then((m) => ({ Component: m.default })) },
  ],
  widgets: [
    { type: "crm.pipeline", title: "Pipeline", description: "Open deals and their value by stage.", defaultSize: { w: 2, h: 1 }, component: lazy(() => import("./widgets").then((m) => ({ default: m.PipelineWidget }))) },
    { type: "crm.open-tasks", title: "Open tasks", description: "Follow-ups due, overdue first. Tick to complete.", defaultSize: { w: 2, h: 2 }, component: lazy(() => import("./widgets").then((m) => ({ default: m.OpenTasksWidget }))) },
    { type: "crm.recent-contacts", title: "Recent contacts", description: "Contacts with the latest activity.", defaultSize: { w: 2, h: 1 }, component: lazy(() => import("./widgets").then((m) => ({ default: m.RecentContactsWidget }))) },
  ],
  quickActions: [{ label: "New contact", to: "/app/crm/contacts?new=1", icon: UserPlus }],
};
