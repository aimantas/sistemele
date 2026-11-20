import type { DevPage } from "@/modules/types.client";

/** Developer panel notes and agent prompts for the website pages (dev mode). */
export const contentDev: DevPage[] = [
  {
    path: "content/pages",
    title: "Website pages",
    summary: "Pages at /<address>: drafts, publishing, the site menu, and the home page (address “home”).",
    files: [
      { path: "src/modules/content/client/PagesPage.tsx", note: "Pages list" },
      { path: "src/modules/content/client/EntriesPage.tsx", note: "Shared list for pages and posts" },
      { path: "src/modules/content/server/service.ts", note: "Entry services and publishing rules" },
      { path: "src/modules/content/server/site.tsx", note: "Public page, blog and home rendering" },
      { path: "migrations/0006_content.sql", note: "Entries table" },
      { path: "tests/content.test.ts", note: "Content tests" },
    ],
    tools: ["content_list_entries", "content_create_entry", "content_publish_entry"],
    prompts: [
      "Add page templates (plain, with a hero image, with a contact form block) chosen in the editor and rendered by the site.",
      "Add a nested menu: let a page sit under another page in the site menu.",
    ],
  },
  {
    path: "content/posts",
    title: "Blog posts",
    summary: "Posts at /blog/<address>: drafts, scheduling, the RSS feed and BlogPosting data.",
    files: [
      { path: "src/modules/content/client/PostsPage.tsx", note: "Posts list" },
      { path: "src/modules/content/server/service.ts", note: "Entry services" },
      { path: "src/modules/content/server/site.tsx", note: "Blog, post pages and RSS" },
    ],
    tools: ["content_list_entries", "content_create_entry", "content_publish_entry", "content_unpublish_entry"],
    prompts: [
      "Add post categories with category pages on the blog and a category in the RSS feed.",
      "Ask an agent with the content_* MCP tools to draft a post from a topic; an owner reviews and publishes it.",
    ],
  },
  {
    path: "content/:id",
    title: "Page or post editor",
    summary: "Markdown editor with preview, address, summary, image, menu position, scheduling and publishing.",
    files: [
      { path: "src/modules/content/client/EntryEditorPage.tsx", note: "The editor and preview" },
      { path: "src/modules/content/shared/markdown.tsx", note: "The Markdown the editor and site support" },
      { path: "src/modules/content/server/service.ts", note: "Saving and publishing rules" },
    ],
    tools: ["content_get_entry", "content_update_entry"],
    prompts: [
      "Add autosave of drafts every 10 seconds with a “Saved” indicator, without creating audit noise.",
      "Add table support to the Markdown renderer used by the editor and the public site, with tests.",
    ],
  },
];
