import { FilePlus, FileText, Newspaper, SquarePen } from "lucide-react";
import { lazy } from "react";
import type { ClientModule } from "@/modules/types.client";

/** Content, browser side: pages, posts and the editor. See src/modules/content/README.md. */
export const contentClient: ClientModule = {
  id: "content",
  name: "Website",
  nav: [
    { to: "/app/content/pages", label: "Pages", icon: FileText },
    { to: "/app/content/posts", label: "Posts", icon: Newspaper },
  ],
  routes: [
    { path: "content/pages", lazy: () => import("./PagesPage").then((m) => ({ Component: m.default })) },
    { path: "content/posts", lazy: () => import("./PostsPage").then((m) => ({ Component: m.default })) },
    { path: "content/:id", lazy: () => import("./EntryEditorPage").then((m) => ({ Component: m.default })) },
  ],
  widgets: [
    {
      type: "content.recent",
      title: "Website content",
      description: "Drafts, scheduled and recently published pages and posts.",
      defaultSize: { w: 2, h: 1 },
      component: lazy(() => import("./widgets").then((m) => ({ default: m.RecentContentWidget }))),
    },
  ],
  quickActions: [
    { label: "New post", to: "/app/content/posts?new=1", icon: SquarePen },
    { label: "New page", to: "/app/content/pages?new=1", icon: FilePlus },
  ],
};
