import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Entry, EntrySummary } from "@/modules/content/shared/schema";
import { defaultBusinessProfile } from "@/shared/business";
import { siteContent } from "@/worker/site/content";
import type { MetricValue, SearchResult } from "@/shared/api";
import { addUser, createTestApp, json, type TestApp } from "./helpers";

let t: TestApp;
let owner: string;
let member: string;
let admin: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
  await addUser(t, "member@content.test", "member");
  await addUser(t, "admin@content.test", "admin");
  member = await t.signIn("member@content.test");
  admin = await t.signIn("admin@content.test");
});
afterAll(() => t.dispose());

type ErrorBody = { error: { code: string; message: string; issues?: Record<string, string> } };

const create = (body: Record<string, unknown>, cookie = owner) => t.request("/api/content/entries", { method: "POST", cookie, json: body });
async function draft(body: Record<string, unknown>, cookie = owner): Promise<Entry> {
  const response = await create(body, cookie);
  expect(response.status).toBe(201);
  return json<Entry>(response);
}
const patch = (id: string, body: Record<string, unknown>, cookie = owner) => t.request(`/api/content/entries/${id}`, { method: "PATCH", cookie, json: body });
const act = (id: string, action: string, body: Record<string, unknown> = {}, cookie = owner) => t.request(`/api/content/entries/${id}/${action}`, { method: "POST", cookie, json: body });
async function publish(id: string, body: Record<string, unknown> = {}): Promise<Entry> {
  const response = await act(id, "publish", body);
  expect(response.status).toBe(200);
  return json<Entry>(response);
}
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe("drafting", () => {
  it("creates a draft with an address made from the title", async () => {
    const page = await draft({ type: "page", title: "Šiltnamių rėmai & vartai" });
    expect(page).toMatchObject({ type: "page", slug: "siltnamiu-remai-vartai", path: "/siltnamiu-remai-vartai", status: "draft", state: "draft", publishedAt: null, body: "", menuOrder: null });
    const again = await draft({ type: "page", title: "Šiltnamių rėmai & vartai" });
    expect(again.slug).toBe("siltnamiu-remai-vartai-2");
    // Pages and posts have separate addresses, so the same slug is fine for a post.
    const post = await draft({ type: "post", title: "Šiltnamių rėmai & vartai" });
    expect(post.path).toBe("/blog/siltnamiu-remai-vartai");
  });

  it("never gives a page an address the system uses", async () => {
    const page = await draft({ type: "page", title: "Products" });
    expect(page.slug).toBe("products-2");
    const reserved = await create({ type: "page", title: "Blog", slug: "blog" });
    expect(reserved.status).toBe(409);
    expect((await json<ErrorBody>(reserved)).error.issues?.slug).toContain("/blog is used by the system");
  });

  it("rejects a taken address, bad input and menu positions on posts", async () => {
    await draft({ type: "page", title: "Delivery", slug: "delivery" });
    const taken = await create({ type: "page", title: "Shipping", slug: "delivery" });
    expect(taken.status).toBe(409);
    expect((await json<ErrorBody>(taken)).error.issues?.slug).toContain("already used by “Delivery”");

    const invalid = await create({ type: "page", title: "", slug: "Not A Slug!" });
    expect(invalid.status).toBe(422);
    const issues = (await json<ErrorBody>(invalid)).error.issues ?? {};
    expect(Object.keys(issues).sort()).toEqual(["slug", "title"]);

    expect((await create({ type: "post", title: "News", menuOrder: 2 })).status).toBe(400);
    expect((await create({ type: "page", title: "Image", imageUrl: "javascript:alert(1)" })).status).toBe(422);
  });

  it("changes only the fields sent", async () => {
    const page = await draft({ type: "page", title: "Opening hours", summary: "When we are open.", body: "Mon–Fri" });
    const updated = await json<Entry>(await patch(page.id, { body: "Mon–Fri 8–17", menuOrder: 3, slug: "hours" }));
    expect(updated).toMatchObject({ title: "Opening hours", summary: "When we are open.", body: "Mon–Fri 8–17", menuOrder: 3, slug: "hours", path: "/hours" });
  });
});

describe("roles", () => {
  it("lets members draft but only owners and admins publish and change live entries", async () => {
    const post = await draft({ type: "post", title: "Member draft", body: "Text" }, member);
    expect((await patch(post.id, { title: "Member draft, edited" }, member)).status).toBe(200);
    expect((await act(post.id, "publish", {}, member)).status).toBe(403);

    expect((await act(post.id, "publish", {}, admin)).status).toBe(200);
    const blocked = await patch(post.id, { title: "Sneaky change" }, member);
    expect(blocked.status).toBe(403);
    expect((await json<ErrorBody>(blocked)).error.message).toBe("Only owners and admins can change a published post.");
    expect((await act(post.id, "archive", {}, member)).status).toBe(403);
    expect((await act(post.id, "unpublish", {}, member)).status).toBe(403);
    expect((await patch(post.id, { title: "Admin change" }, admin)).status).toBe(200);
  });

  it("requires sign-in", async () => {
    expect((await t.request("/api/content/entries")).status).toBe(401);
  });
});

describe("publishing and the public site", () => {
  it("shows a page only once it is published, with its menu link", async () => {
    const page = await draft({ type: "page", title: "About the workshop", slug: "about", summary: "Who we are.", body: "We weld.\n\n## Contact\n\n<script>alert(1)</script>", menuOrder: 1 });
    expect((await t.request("/about")).status).toBe(404);
    expect(await (await t.request("/")).text()).not.toContain('href="/about"');

    // Publishing needs text.
    const empty = await draft({ type: "page", title: "Empty" });
    expect((await act(empty.id, "publish")).status).toBe(400);

    const live = await publish(page.id);
    expect(live.state).toBe("published");
    const response = await t.request("/about");
    expect(response.status).toBe(200);
    const htmlText = await response.text();
    expect(htmlText).toContain("<h1>About the workshop</h1>");
    expect(htmlText).toContain('<h2 id="contact">Contact</h2>');
    expect(htmlText).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(htmlText).toContain('<meta name="description" content="Who we are."/>');
    expect(htmlText).toContain('<link rel="canonical" href="http://localhost/about"/>');
    // In the header menu on every public page, before the call to action.
    const home = await (await t.request("/")).text();
    expect(home).toContain('href="/about">About the workshop</a>');
    expect(home.indexOf('href="/about"')).toBeLessThan(home.indexOf('href="/contact"'));

    const markdown = await t.request("/about", { headers: { accept: "text/markdown" } });
    expect(await markdown.text()).toBe("# About the workshop\n\nWe weld.\n\n## Contact\n\n<script>alert(1)</script>\n");

    // A live address cannot change; unpublishing frees it.
    expect((await patch(page.id, { slug: "about-us" })).status).toBe(409);
    expect((await act(page.id, "unpublish")).status).toBe(200);
    expect((await t.request("/about")).status).toBe(404);
    expect(await (await t.request("/")).text()).not.toContain('href="/about"');
  });

  it("schedules entries for later and backdates them", async () => {
    const scheduled = await draft({ type: "post", title: "Coming soon", body: "Soon." });
    const result = await publish(scheduled.id, { publishAt: inDays(2) });
    expect(result.state).toBe("scheduled");
    expect((await t.request(result.path)).status).toBe(404);
    const list = await json<{ items: EntrySummary[] }>(await t.request("/api/content/entries?state=scheduled", { cookie: owner }));
    expect(list.items.map((item) => item.id)).toContain(scheduled.id);

    const old = await draft({ type: "post", title: "From the archive", body: "Old news." });
    const backdated = await publish(old.id, { publishAt: "2025-03-01T09:00:00+02:00" });
    expect(backdated).toMatchObject({ state: "published", publishedAt: "2025-03-01T07:00:00.000Z" });
    expect((await t.request(backdated.path)).status).toBe(200);

    expect((await act(old.id, "publish", { publishAt: "tomorrow" })).status).toBe(422);
  });

  it("serves the blog, a post with article data and an RSS feed", async () => {
    const first = await draft({ type: "post", title: "First post", body: "Hello **world**.", imageUrl: "/brand/logo.svg", imageAlt: "Logo" });
    await publish(first.id, { publishAt: inDays(-2) });
    const second = await draft({ type: "post", title: "Second & <latest>", summary: "The newest one.", body: "More." });
    await publish(second.id);

    const blog = await t.request("/blog");
    const blogHtml = await blog.text();
    expect(blog.status).toBe(200);
    expect(blogHtml).not.toContain("noindex");
    expect(blogHtml.indexOf("Second &amp; &lt;latest&gt;")).toBeLessThan(blogHtml.indexOf("First post"));
    expect(blogHtml).toContain('<link rel="alternate" type="application/rss+xml" href="http://localhost/blog/feed.xml"');
    expect(blogHtml).toContain('<a href="/blog" aria-current="page">Blog</a>');
    expect(await (await t.request("/")).text()).toContain('<a href="/blog">Blog</a>');

    const post = await (await t.request("/blog/first-post")).text();
    expect(post).toContain("<strong>world</strong>");
    expect(post).toContain('<meta property="og:type" content="article"/>');
    expect(post).toContain('<meta property="og:image" content="http://localhost/brand/logo.svg"/>');
    expect(post).toContain('"@type":"BlogPosting"');
    expect(post).toContain('<img class="entry-image" src="http://localhost/brand/logo.svg" alt="Logo"/>');

    const feed = await t.request("/blog/feed.xml");
    expect(feed.headers.get("content-type")).toContain("application/rss+xml");
    const xml = await feed.text();
    expect(xml).toContain("<title>Second &#38; &#60;latest&#62;</title>");
    expect(xml).toContain("<description>The newest one.</description>");
    expect(xml).toContain("<link>http://localhost/blog/first-post</link>");

    expect((await t.request("/blog?page=1")).status).toBe(301);
    expect((await t.request("/blog?page=99")).status).toBe(404);
    expect((await t.request("/blog/no-such-post")).status).toBe(404);
  });

  it("lists live entries in the sitemap only", async () => {
    const hidden = await draft({ type: "page", title: "Secret plans", body: "Draft." });
    const sitemap = await (await t.request("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>http://localhost/blog</loc>");
    expect(sitemap).toContain("<loc>http://localhost/blog/first-post</loc>");
    expect(sitemap).not.toContain(hidden.slug);
    expect(sitemap).not.toContain("coming-soon");
  });

  it("leaves other addresses to the rest of the app", async () => {
    expect((await t.request("/app")).status).toBe(200);
    expect(await (await t.request("/app")).text()).toContain('<div id="root">');
    expect((await t.request("/products")).status).toBe(200);
    expect((await t.request("/no-such-page")).status).toBe(404);
    expect((await t.request("/favicon.svg")).status).toBe(404);
    expect((await t.request("/Not-Lowercase")).status).toBe(404);
  });

  it("archives and restores as a draft", async () => {
    const post = await draft({ type: "post", title: "To archive", body: "Text." });
    await publish(post.id);
    const archived = await json<Entry>(await act(post.id, "archive"));
    expect(archived).toMatchObject({ status: "archived", publishedAt: null });
    expect((await t.request(post.path)).status).toBe(404);
    expect((await patch(post.id, { title: "x" })).status).toBe(400);
    const active = await json<{ items: EntrySummary[] }>(await t.request("/api/content/entries?q=To%20archive", { cookie: owner }));
    expect(active.items).toHaveLength(0);
    const restored = await json<Entry>(await act(post.id, "restore", {}, member));
    expect(restored.status).toBe("draft");
  });
});

describe("dashboard and agents", () => {
  it("reports publishing numbers, search results and an audit trail", async () => {
    const metrics = await json<{ items: MetricValue[] }>(await t.request("/api/metrics?keys=content.published_30d", { cookie: owner }));
    expect(metrics.items[0]).toMatchObject({ key: "content.published_30d", format: "number" });
    expect(metrics.items[0].value).toBeGreaterThanOrEqual(2);
    expect(metrics.items[0].hint).toContain("scheduled");

    const results = await json<{ items: SearchResult[] }>(await t.request("/api/search?q=first%20post", { cookie: owner }));
    expect(results.items.find((item) => item.module === "content")).toMatchObject({ title: "First post", href: expect.stringMatching(/^\/app\/content\/cnt_/u) });

    const audit = await t.db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE action = 'content.published'").first<{ n: number }>();
    expect(audit?.n).toBeGreaterThan(0);
  });

  it("lets an agent with a member token draft but not publish", async () => {
    const token = await t.createToken(member, "member");
    const call = (name: string, args: Record<string, unknown>) => t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } });

    const tools = await json<{ result: { tools: Array<{ name: string }> } }>(await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 1, method: "tools/list" } }));
    const names = tools.result.tools.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["content_list_entries", "content_get_entry", "content_create_entry", "content_update_entry"]));
    expect(names).not.toContain("content_publish_entry");

    const created = await json<{ result: { structuredContent: Entry } }>(await call("content_create_entry", { type: "page", title: "Agent page", body: "## Hello\n\nWritten by an agent." }));
    expect(created.result.structuredContent).toMatchObject({ status: "draft", path: "/agent-page" });

    const byPath = await json<{ result: { structuredContent: Entry } }>(await call("content_get_entry", { entry: "/agent-page" }));
    expect(byPath.result.structuredContent.body).toContain("Written by an agent.");

    const edited = await json<{ result: { structuredContent: Entry } }>(await call("content_update_entry", { entry: "/agent-page", changes: { summary: "Short." } }));
    expect(edited.result.structuredContent.summary).toBe("Short.");

    const denied = await json<{ result: { isError: boolean } }>(await call("content_publish_entry", { entry: "/agent-page" }));
    expect(denied.result.isError).toBe(true);

    const ownerToken = await t.createToken(owner, "owner");
    const published = await json<{ result: { structuredContent: Entry } }>(
      await t.request("/mcp", { method: "POST", token: ownerToken, json: { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "content_publish_entry", arguments: { entry: "/agent-page" } } } }),
    );
    expect(published.result.structuredContent.state).toBe("published");
    expect((await t.request("/agent-page")).status).toBe(200);
  });
});

describe("home page", () => {
  it("shows the latest posts under the default headline", async () => {
    const home = await (await t.request("/")).text();
    expect(home).toContain(`<h1>${defaultBusinessProfile.name}</h1>`);
    expect(home).toContain(`<p class="lead">${siteContent.home.lead}</p>`);
    expect(home).toContain('<a class="button primary" href="/contact">Get in touch</a>');
    expect(home).toContain('<a class="button" href="/products">Products</a>');
    expect(home).toContain("<h2>From the blog</h2>");
    expect(home).toContain('<a href="/blog">All posts</a>');
    const markdown = await (await t.request("/", { headers: { accept: "text/markdown" } })).text();
    expect(markdown).toContain("## From the blog");
    expect(markdown).toContain("(http://localhost/blog/");
  });

  it("lets a page with the address home replace the headline at /", async () => {
    const page = await draft({ type: "page", title: "Gates and frames, made to measure", slug: "home", summary: "Send a drawing; get a priced quote.", body: "Read [how ordering works](/about)." });
    expect(page.path).toBe("/");
    // A draft changes nothing.
    expect(await (await t.request("/")).text()).toContain(siteContent.home.lead);

    await publish(page.id);
    const home = await (await t.request("/")).text();
    expect(home).toContain("<h1>Gates and frames, made to measure</h1>");
    expect(home).toContain('<p class="lead">Send a drawing; get a priced quote.</p>');
    expect(home).toContain('<a href="/about">how ordering works</a>');
    expect(home).toContain('<meta name="description" content="Send a drawing; get a priced quote."/>');
    expect(home).not.toContain(siteContent.home.lead);
    expect(home).toContain("<h2>From the blog</h2>");
    // One link to "/" in the menu: the home page never becomes a second entry.
    expect(home.match(/href="\/"/gu)?.length).toBe(2);

    const redirect = await t.request("/home");
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get("location")).toBe("/");
    expect(await (await t.request("/sitemap.xml")).text()).not.toContain("<loc>http://localhost/home</loc>");

    await act(page.id, "unpublish");
    expect(await (await t.request("/")).text()).toContain(siteContent.home.lead);
    expect((await t.request("/home")).status).toBe(404);
  });
});
