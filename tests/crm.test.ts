import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addUser, createTestApp, json, type TestApp } from "./helpers";
import type { Contact, ContactDetail, Deal, Lead, LeadDetail, Stage } from "@/modules/crm/shared/schema";

type LeadPage = { items: Lead[]; total: number; counts: Record<string, number> };

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
    expect(deal).toMatchObject({ stage: "qualified", stageLabel: "Qualified", stageKind: "open", probabilityBps: 2000, contactName: "Pipeline Co", closedAt: null, ownerName: "owner" });

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
  it("accepts the HTML form, creates a lead, emails the business and redirects back", async () => {
    await t.request("/api/settings/business", { method: "PUT", cookie: owner, json: { name: "Acme", email: "sales@acme.test" } });
    const body = new URLSearchParams({ name: "Ona", email: "ona@example.com", company: "Ona Build", message: "Need 40 m² of mesh by Friday" });
    const response = await t.request("/api/public/crm/inquiries", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/contact?sent=1");
    await t.settle();

    const leads = await json<{ items: Lead[] }>(await t.request("/api/crm/leads?q=ona", { cookie: owner }));
    expect(leads.items).toHaveLength(1);
    expect(leads.items[0]).toMatchObject({ name: "Ona", company: "Ona Build", source: "website", status: "new", ownerId: null, message: "Need 40 m² of mesh by Friday" });
    expect((await json<{ total: number }>(await t.request("/api/crm/contacts?q=ona", { cookie: owner }))).total).toBe(0);

    const emails = await t.db.prepare("SELECT template, to_address FROM email_log WHERE template = 'crm.inquiry_received'").all();
    expect(emails.results).toEqual([{ template: "crm.inquiry_received", to_address: "sales@acme.test" }]);
  });

  it("adds a repeat request to the open lead and rejects bots", async () => {
    const response = await t.request("/api/public/crm/inquiries", { method: "POST", json: { name: "Ona", email: "ONA@example.com", message: "Second request" } });
    expect(response.status).toBe(201);
    const leads = await json<{ items: Lead[] }>(await t.request("/api/crm/leads?q=ona@example.com", { cookie: owner }));
    expect(leads.items).toHaveLength(1);
    const detail = await json<LeadDetail>(await t.request(`/api/crm/leads/${leads.items[0].id}`, { cookie: owner }));
    expect(detail.activities[0].body).toContain("Second request");

    const bot = await t.request("/api/public/crm/inquiries", { method: "POST", json: { name: "Bot", email: "bot@example.com", message: "spam", website: "http://spam" } });
    expect(bot.status).toBe(422);
  });
});

describe("leads", () => {
  const createLead = async (input: Record<string, unknown>) => json<Lead>(await t.request("/api/crm/leads", { method: "POST", cookie: owner, json: input }));

  it("creates a lead owned by the creator and filters by status, owner and due follow-ups", async () => {
    const lead = await createLead({ name: "Rūta", company: "Rūta Studio", email: "ruta@studio.test", source: "referral", valueCents: 120000, followUpOn: "2020-01-01" });
    expect(lead).toMatchObject({ status: "new", source: "referral", valueCents: 120000, ownerName: "owner", followUpOn: "2020-01-01" });
    await createLead({ name: "Nobody's", ownerId: null });

    const mine = await json<LeadPage>(await t.request("/api/crm/leads?ownerId=me", { cookie: owner }));
    expect(mine.items.map((item) => item.id)).toContain(lead.id);
    const unassigned = await json<LeadPage>(await t.request("/api/crm/leads?ownerId=none", { cookie: owner }));
    expect(unassigned.items.every((item) => item.ownerId === null)).toBe(true);
    const due = await json<LeadPage>(await t.request("/api/crm/leads?due=1", { cookie: owner }));
    expect(due.items.map((item) => item.id)).toEqual([lead.id]);
    expect(due.counts).toMatchObject({ due: 1 });
    expect(due.counts.open).toBeGreaterThanOrEqual(2);

    const invalid = await t.request("/api/crm/leads", { method: "POST", cookie: owner, json: { name: "X", ownerId: "usr_missing" } });
    expect(invalid.status).toBe(422);
  });

  it("marks a new lead contacted when a call is logged, and needs a reason to disqualify", async () => {
    const lead = await createLead({ name: "Call Me" });
    await t.request("/api/crm/activities", { method: "POST", cookie: owner, json: { leadId: lead.id, kind: "call", body: "Left a voicemail" } });
    const contacted = await json<LeadDetail>(await t.request(`/api/crm/leads/${lead.id}`, { cookie: owner }));
    expect(contacted.lead.status).toBe("contacted");
    expect(contacted.activities.map((a) => a.body)).toEqual(expect.arrayContaining(["Left a voicemail", "Status: New → Contacted."]));

    const noReason = await t.request(`/api/crm/leads/${lead.id}`, { method: "PATCH", cookie: owner, json: { status: "disqualified" } });
    expect(noReason.status).toBe(422);
    expect((await json<{ error: { issues: Record<string, string> } }>(noReason)).error.issues).toHaveProperty("disqualifyReason");

    const out = await json<Lead>(await t.request(`/api/crm/leads/${lead.id}`, { method: "PATCH", cookie: owner, json: { status: "disqualified", disqualifyReason: "No budget" } }));
    expect(out).toMatchObject({ status: "disqualified", disqualifyReason: "No budget" });
    expect((await t.request(`/api/crm/leads/${lead.id}/convert`, { method: "POST", cookie: owner, json: {} })).status).toBe(409);

    const reopened = await json<Lead>(await t.request(`/api/crm/leads/${lead.id}`, { method: "PATCH", cookie: owner, json: { status: "new" } }));
    expect(reopened).toMatchObject({ status: "new", disqualifyReason: "" });
  });

  it("converts a lead into a contact and a deal and moves its timeline", async () => {
    const lead = await createLead({ name: "Jonas", company: "Jonas Farms", email: "jonas@farms.test", phone: "+370 600", source: "event", valueCents: 50000 });
    await t.request("/api/crm/activities", { method: "POST", cookie: owner, json: { leadId: lead.id, kind: "note", body: "Met at the fair" } });

    const result = await json<{ lead: Lead; contact: Contact; deal: Deal }>(await t.request(`/api/crm/leads/${lead.id}/convert`, { method: "POST", cookie: owner, json: { stage: "proposal" } }));
    expect(result.contact).toMatchObject({ name: "Jonas Farms", kind: "company", email: "jonas@farms.test", source: "event", notes: "Contact person: Jonas" });
    expect(result.deal).toMatchObject({ title: "Jonas Farms", valueCents: 50000, stage: "proposal", contactId: result.contact.id });
    expect(result.lead).toMatchObject({ status: "converted", contactId: result.contact.id, dealId: result.deal.id, contactName: "Jonas Farms" });

    const contact = await json<ContactDetail>(await t.request(`/api/crm/contacts/${result.contact.id}`, { cookie: owner }));
    expect(contact.activities.map((a) => a.body)).toEqual(expect.arrayContaining(["Met at the fair", "Converted from lead Jonas into deal Jonas Farms."]));
    expect(contact.leads.map((l) => l.id)).toEqual([lead.id]);

    expect((await t.request(`/api/crm/leads/${lead.id}`, { method: "PATCH", cookie: owner, json: { name: "Changed" } })).status).toBe(409);
    expect((await t.request(`/api/crm/leads/${lead.id}/convert`, { method: "POST", cookie: owner, json: {} })).status).toBe(409);
  });

  it("reuses a contact with the same email and can skip the deal", async () => {
    const existing = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Repeat Buyer UAB", email: "buyer@repeat.test" } }));
    const lead = await createLead({ name: "Buyer", email: "BUYER@repeat.test" });
    const detail = await json<LeadDetail>(await t.request(`/api/crm/leads/${lead.id}`, { cookie: owner }));
    expect(detail.matchingContact).toEqual({ id: existing.id, name: "Repeat Buyer UAB" });

    const result = await json<{ contact: Contact; deal: Deal | null }>(await t.request(`/api/crm/leads/${lead.id}/convert`, { method: "POST", cookie: owner, json: { createDeal: false } }));
    expect(result.contact.id).toBe(existing.id);
    expect(result.deal).toBeNull();
  });
});

describe("pipeline stages", () => {
  it("lists the default stages in board order", async () => {
    const { items } = await json<{ items: Stage[] }>(await t.request("/api/crm/stages", { cookie: owner }));
    expect(items.map((stage) => [stage.id, stage.kind, stage.probabilityBps])).toEqual([
      ["qualified", "open", 2000],
      ["proposal", "open", 5000],
      ["negotiation", "open", 8000],
      ["won", "won", 10000],
      ["lost", "lost", 0],
    ]);
  });

  it("lets admins add, rename, reorder and remove stages, and keeps members out", async () => {
    await addUser(t, "rep@example.com", "member");
    const member = await t.signIn("rep@example.com");
    expect((await t.request("/api/crm/stages", { method: "POST", cookie: member, json: { label: "Demo" } })).status).toBe(403);

    const demo = await json<Stage>(await t.request("/api/crm/stages", { method: "POST", cookie: owner, json: { label: "Demo booked", probabilityBps: 3500 } }));
    expect(demo).toMatchObject({ id: "demo-booked", kind: "open", probabilityBps: 3500 });
    const again = await json<Stage>(await t.request("/api/crm/stages", { method: "POST", cookie: owner, json: { label: "Demo booked" } }));
    expect(again.id).toBe("demo-booked-2");

    const won = await json<Stage>(await t.request("/api/crm/stages/won", { method: "PATCH", cookie: owner, json: { label: "Signed", probabilityBps: 10 } }));
    expect(won).toMatchObject({ label: "Signed", probabilityBps: 10000 });

    const order = ["demo-booked", "qualified", "proposal", "negotiation", "demo-booked-2"];
    const reordered = await json<{ items: Stage[] }>(await t.request("/api/crm/stages/order", { method: "POST", cookie: owner, json: { ids: order } }));
    expect(reordered.items.filter((stage) => stage.kind === "open").map((stage) => stage.id)).toEqual(order);
    expect((await t.request("/api/crm/stages/order", { method: "POST", cookie: owner, json: { ids: ["qualified"] } })).status).toBe(422);

    // A stage with deals needs a target for them.
    const contact = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Stage Co" } }));
    const deal = await json<Deal>(await t.request("/api/crm/deals", { method: "POST", cookie: owner, json: { contactId: contact.id, title: "Demo deal", stage: "demo-booked-2" } }));
    expect((await t.request("/api/crm/stages/demo-booked-2", { method: "DELETE", cookie: owner })).status).toBe(422);
    expect((await t.request("/api/crm/stages/demo-booked-2?moveTo=proposal", { method: "DELETE", cookie: owner })).status).toBe(200);
    expect((await json<Deal>(await t.request(`/api/crm/deals/${deal.id}`, { cookie: owner }))).stage).toBe("proposal");
    expect((await t.request("/api/crm/stages/lost", { method: "DELETE", cookie: owner })).status).toBe(409);
  });

  it("rejects unknown stages and records why a deal was lost", async () => {
    const contact = await json<Contact>(await t.request("/api/crm/contacts", { method: "POST", cookie: owner, json: { name: "Lost Co" } }));
    const bad = await t.request("/api/crm/deals", { method: "POST", cookie: owner, json: { contactId: contact.id, title: "X", stage: "nope" } });
    expect(bad.status).toBe(422);

    const deal = await json<Deal>(await t.request("/api/crm/deals", { method: "POST", cookie: owner, json: { contactId: contact.id, title: "Fence", valueCents: 10000 } }));
    const lost = await json<Deal>(await t.request(`/api/crm/deals/${deal.id}/move`, { method: "POST", cookie: owner, json: { stage: "lost", position: 1, lostReason: "Too expensive" } }));
    expect(lost).toMatchObject({ stageKind: "lost", lostReason: "Too expensive" });
    expect(lost.closedAt).not.toBeNull();
    const reopened = await json<Deal>(await t.request(`/api/crm/deals/${deal.id}`, { method: "PATCH", cookie: owner, json: { stage: "negotiation" } }));
    expect(reopened).toMatchObject({ stage: "negotiation", lostReason: "", closedAt: null });
  });

  it("weights the open pipeline by stage probability", async () => {
    const fresh = await createTestApp();
    const cookie = await fresh.signIn();
    const contact = await json<Contact>(await fresh.request("/api/crm/contacts", { method: "POST", cookie, json: { name: "Weight Co" } }));
    await fresh.request("/api/crm/deals", { method: "POST", cookie, json: { contactId: contact.id, title: "A", valueCents: 100000, stage: "qualified" } });
    await fresh.request("/api/crm/deals", { method: "POST", cookie, json: { contactId: contact.id, title: "B", valueCents: 100000, stage: "negotiation" } });
    const metrics = await json<{ items: Array<{ key: string; value: number }> }>(await fresh.request("/api/metrics", { cookie }));
    const value = (key: string) => metrics.items.find((m) => m.key === key)?.value;
    expect(value("crm.open_pipeline_value")).toBe(200000);
    expect(value("crm.weighted_pipeline_value")).toBe(100000);
    await fresh.dispose();
  });
});

describe("MCP tools", () => {
  it("lets an agent create, qualify and convert a lead, and keeps stage changes for admins", async () => {
    const token = await t.createToken(owner, "member");
    const call = async (name: string, args: Record<string, unknown>) =>
      json<{ result: { structuredContent: Record<string, unknown>; isError?: boolean } }>(
        await t.request("/mcp", { method: "POST", token, json: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } }),
      );

    const created = (await call("crm_create_lead", { name: "Agent Lead", email: "agent@lead.test", source: "outbound", valueCents: 9900 })).result.structuredContent as unknown as Lead;
    expect(created).toMatchObject({ status: "new", source: "outbound" });
    await call("crm_update_lead", { leadId: created.id, changes: { status: "qualified" } });
    const converted = (await call("crm_convert_lead", { leadId: created.id, dealTitle: "Agent deal" })).result.structuredContent as { deal: Deal };
    expect(converted.deal).toMatchObject({ title: "Agent deal", valueCents: 9900, stageKind: "open" });

    const listed = (await call("crm_list_leads", { status: "converted", query: "agent@lead.test" })).result.structuredContent as { total: number };
    expect(listed.total).toBe(1);
    const team = (await call("core_list_team", {})).result.structuredContent as { items: Array<{ email: string }> };
    expect(team.items.map((member) => member.email)).toContain("owner@example.com");

    const denied = await call("crm_create_stage", { label: "Nope" });
    expect(denied.result.isError).toBe(true);
  });
});
