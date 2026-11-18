import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, json, type TestApp } from "./helpers";
import type { Contact, ContactDetail, Deal } from "@/modules/crm/shared/schema";

let t: TestApp;
let owner: string;

beforeAll(async () => {
  t = await createTestApp();
  owner = await t.signIn();
});
afterAll(() => t.dispose());

describe("contacts", () => {
  it("creates, finds, updates and archives a contact", async () => {
    const created = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Baltic Build UAB", email: "info@balticbuild.test", tags: ["vip"] } }));
    expect(created).toMatchObject({ name: "Baltic Build UAB", kind: "company", tags: ["vip"], source: "manual" });

    const found = await json<{ items: Contact[]; total: number }>(await t.request("/api/crm/contacts?q=baltic", { cookie: owner }));
    expect(found.total).toBe(1);
    const tagged = await json<{ items: Contact[] }>(await t.request("/api/crm/contacts?tag=vip", { cookie: owner }));
    expect(tagged.items).toHaveLength(1);

    const updated = await json<Contact>(await t.request(`/api/crm/contacts/${created.id}`, { method: "PATCH", cookie: owner, json: { phone: "+370 600 00000", country: "lt" } }));
    expect(updated).toMatchObject({ phone: "+370 600 00000", country: "LT" });

    await t.request(`/api/crm/contacts/${created.id}`, { method: "DELETE", cookie: owner });
    expect((await json<{ total: number }>(await t.request("/api/crm/contacts?q=baltic", { cookie: owner }))).total).toBe(0);
  });

  it("validates input with field messages", async () => {
    const response = await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "", email: "nope" } });
    expect(response.status).toBe(422);
    const body = await json<{ error: { issues: Record<string, string> } }>(response);
    expect(Object.keys(body.error.issues)).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it("treats LIKE wildcards in search literally", async () => {
    await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "100% Steel" } });
    await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Other Co" } });
    const found = await json<{ items: Contact[] }>(await t.request(`/api/crm/contacts?q=${encodeURIComponent("%")}`, { cookie: owner }));
    expect(found.items.map((c) => c.name)).toEqual(["100% Steel"]);
  });
});

describe("partial updates", () => {
  it("PATCH changes only the fields it sends", async () => {
    const contact = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Keep Co", email: "keep@co.test", tags: ["a"], notes: "Keep me" } }));
    const patched = await json<Contact>(await t.request(`/api/crm/contacts/${contact.id}`, { method: "PATCH", cookie: owner, json: { phone: "+370 1" } }));
    expect(patched).toMatchObject({ phone: "+370 1", email: "keep@co.test", tags: ["a"], notes: "Keep me", kind: "company" });

    const deal = await json<Deal>(await t.request("/api/crm/deals", { method: "POST", cookie: owner, json: { contactId: contact.id, title: "Big", valueCents: 5000, stage: "proposal" } }));
    const renamed = await json<Deal>(await t.request(`/api/crm/deals/${deal.id}`, { method: "PATCH", cookie: owner, json: { title: "Bigger" } }));
    expect(renamed).toMatchObject({ title: "Bigger", valueCents: 5000, stage: "proposal" });
  });
});

describe("pipeline", () => {
  it("moves deals between stages and closes won deals", async () => {
    const contact = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Pipeline Co" } }));
    const deal = await json<Deal>(await t.request("/api/crm/deals", { method: "POST", cookie: owner, json: { contactId: contact.id, title: "Warehouse racks", valueCents: 250000 } }));
    expect(deal).toMatchObject({ stage: "lead", contactName: "Pipeline Co", closedAt: null });

    const won = await json<Deal>(await t.request(`/api/crm/deals/${deal.id}/move`, { method: "POST", cookie: owner, json: { stage: "won", position: 1 } }));
    expect(won.stage).toBe("won");
    expect(won.closedAt).not.toBeNull();

    const reopened = await json<Deal>(await t.request(`/api/crm/deals/${deal.id}/move`, { method: "POST", cookie: owner, json: { stage: "proposal", position: 1 } }));
    expect(reopened.closedAt).toBeNull();
  });

  it("adds notes and tasks to the timeline and completes tasks", async () => {
    const contact = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Timeline Co" } }));
    await t.request("/api/crm/activities", { method: "POST", cookie: owner, json: { contactId: contact.id, kind: "note", body: "Called, wants a quote" } });
    const task = await json<{ id: string }>(await t.request("/api/crm/activities", { method: "POST", cookie: owner, json: { contactId: contact.id, kind: "task", body: "Send quote", dueAt: "2026-01-01" } }));

    const open = await json<{ items: Array<{ id: string }> }>(await t.request("/api/crm/activities?open=1", { cookie: owner }));
    expect(open.items.map((a) => a.id)).toContain(task.id);
    await t.request(`/api/crm/activities/${task.id}/complete`, { method: "POST", cookie: owner, json: {} });

    const detail = await json<ContactDetail>(await t.request(`/api/crm/contacts/${contact.id}`, { cookie: owner }));
    expect(detail.activities).toHaveLength(2);
    expect(detail.activities.find((a) => a.id === task.id)?.doneAt).not.toBeNull();
  });
});

describe("website requests", () => {
  it("accepts the HTML form, creates a contact and a lead, and redirects back", async () => {
    await t.request("/api/settings/business", { method: "PUT", cookie: owner, json: { name: "Acme", email: "sales@acme.test" } });
    const body = new URLSearchParams({ name: "Ona", email: "ona@example.com", company: "Ona Build", message: "Need 40 m² of mesh by Friday" });
    const response = await t.request("/api/public/crm/inquiries", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/contact?sent=1");
    await t.settle();

    const contacts = await json<{ items: Contact[] }>(await t.request("/api/crm/contacts?q=ona", { cookie: owner }));
    expect(contacts.items[0]).toMatchObject({ name: "Ona Build", source: "website" });
    const deals = await json<{ items: Deal[] }>(await t.request(`/api/crm/deals?contactId=${contacts.items[0].id}`, { cookie: owner }));
    expect(deals.items[0].stage).toBe("lead");

    const emails = await t.db.prepare("SELECT template, to_address FROM email_log WHERE template = 'crm.inquiry_received'").all();
    expect(emails.results).toEqual([{ template: "crm.inquiry_received", to_address: "sales@acme.test" }]);
  });

  it("reuses the contact for a repeat request and rejects bots", async () => {
    await t.request("/api/public/crm/inquiries", { method: "POST", json: { name: "Ona", email: "ONA@example.com", message: "Second request" } });
    const contacts = await json<{ total: number }>(await t.request("/api/crm/contacts?q=ona@example.com", { cookie: owner }));
    expect(contacts.total).toBe(1);

    const bot = await t.request("/api/public/crm/inquiries", { method: "POST", json: { name: "Bot", email: "bot@example.com", message: "spam", website: "http://spam" } });
    expect(bot.status).toBe(422);
  });
});
