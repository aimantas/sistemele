import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { Copy, KeyRound, Plus } from "lucide-react";
import { useState } from "react";
import { NavLink, Outlet } from "react-router";
import { ROLES, type Role } from "@/shared/auth";
import type { BusinessProfile } from "@/shared/business";
import { api, fieldError } from "../lib/api";
import { useFormat } from "../lib/format";
import { useAppInfo, useCan, useUser } from "../lib/session";
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Select, Spinner, Table, Td, Textarea, Th, Tr, useToast } from "../ui";

const tabs = [
  { to: "/app/settings", label: "Company", end: true },
  { to: "/app/settings/brand", label: "Brand" },
  { to: "/app/settings/team", label: "Team", admin: true },
  { to: "/app/settings/api", label: "API & agents" },
  { to: "/app/settings/email", label: "Email", admin: true },
  { to: "/app/settings/audit", label: "Audit log", admin: true },
  { to: "/app/settings/modules", label: "Modules" },
];

export function SettingsLayout() {
  const isAdmin = useCan("admin");
  return (
    <div>
      <PageHeader title="Settings" />
      <nav aria-label="Settings" className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {tabs
          .filter((tab) => !tab.admin || isAdmin)
          .map((tab) => (
            <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => clsx("-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap", isActive ? "border-primary text-primary" : "border-transparent text-foreground/80 hover:text-foreground")}>
              {tab.label}
            </NavLink>
          ))}
      </nav>
      <Outlet />
    </div>
  );
}

export function BusinessSettingsPage() {
  const isAdmin = useCan("admin");
  const toast = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["settings", "business"], queryFn: () => api.get<{ business: BusinessProfile }>("/api/settings/business") });
  const [form, setForm] = useState<BusinessProfile | null>(null);
  const save = useMutation({
    mutationFn: (business: BusinessProfile) => api.put<{ business: BusinessProfile }>("/api/settings/business", business),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "business"], data);
      setForm(null);
      toast("Business details saved");
    },
  });
  if (query.isLoading) return <Spinner />;
  if (query.error || !query.data) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const value = form ?? query.data.business;
  const set = <K extends keyof BusinessProfile>(key: K, next: BusinessProfile[K]) => setForm({ ...value, [key]: next });
  const text = (key: keyof BusinessProfile, label: string, hint?: string) => (
    <Field label={label} hint={hint} error={fieldError(save.error, key)}>
      {(props) => <Input {...props} disabled={!isAdmin} value={String(value[key] ?? "")} onChange={(event) => set(key, event.target.value as never)} />}
    </Field>
  );

  return (
    <form
      className="grid max-w-3xl gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(value);
      }}
    >
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Company</h2>
        {text("name", "Display name")}
        {text("legalName", "Legal name", "Printed on invoices.")}
        {text("companyCode", "Company code")}
        {text("vatCode", "VAT code")}
        <div className="sm:col-span-2">{text("address", "Address")}</div>
        {text("email", "Email", "Receives website requests; customers reply here.")}
        {text("phone", "Phone")}
        {text("website", "Website")}
      </Card>
      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <h2 className="text-lg font-semibold sm:col-span-2">Payments and documents</h2>
        {text("bankName", "Bank")}
        {text("iban", "IBAN", "Shown on invoices for bank transfer.")}
        {text("invoicePrefix", "Invoice number prefix", "INV gives INV-2026-0001.")}
        {text("quotePrefix", "Quote number prefix")}
        <Field label="Default VAT rate (%)" error={fieldError(save.error, "defaultVatRateBps")}>
          {(props) => <Input {...props} disabled={!isAdmin} inputMode="decimal" value={value.defaultVatRateBps / 100} onChange={(event) => set("defaultVatRateBps", Math.round(Number(event.target.value.replace(",", ".")) * 100) || 0)} />}
        </Field>
        <Field label="Payment terms (days)" error={fieldError(save.error, "paymentTermsDays")}>
          {(props) => <Input {...props} disabled={!isAdmin} inputMode="numeric" value={value.paymentTermsDays} onChange={(event) => set("paymentTermsDays", Number(event.target.value) || 0)} />}
        </Field>
        <Field label="Invoice footer" className="sm:col-span-2" error={fieldError(save.error, "invoiceFooter")}>
          {(props) => <Textarea {...props} disabled={!isAdmin} value={value.invoiceFooter} onChange={(event) => set("invoiceFooter", event.target.value)} />}
        </Field>
      </Card>
      <FormError error={save.error} />
      {isAdmin ? (
        <div className="flex gap-2">
          <Button type="submit" variant="default" loading={save.isPending} disabled={!form}>
            Save business details
          </Button>
          {form ? (
            <Button variant="ghost" onClick={() => setForm(null)}>
              Discard changes
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Only owners and admins can change business details.</p>
      )}
    </form>
  );
}

interface TeamUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "disabled";
  lastLoginAt: string | null;
}

export function TeamSettingsPage() {
  const me = useUser();
  const format = useFormat();
  const toast = useToast();
  const queryClient = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get<{ items: TeamUser[] }>("/api/users") });
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ email: "", name: "", role: "member" as Role });
  const create = useMutation({
    mutationFn: () => api.post("/api/users", invite),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setInviting(false);
      setInvite({ email: "", name: "", role: "member" });
      toast("Invitation sent");
    },
  });
  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; role?: Role; status?: TeamUser["status"] }) => api.patch(`/api/users/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onError: (error) => toast(error.message, "danger"),
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-foreground/80">Owners manage everything. Admins manage team and settings. Members work with records.</p>
        <Button variant="default" icon={<Plus />} onClick={() => setInviting(true)}>
          Invite person
        </Button>
      </div>
      {users.isLoading ? <Spinner /> : null}
      {users.error ? <ErrorState error={users.error} /> : null}
      {users.data ? (
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Role</Th>
              <Th>Last sign-in</Th>
              <Th>Access</Th>
            </tr>
          </thead>
          <tbody>
            {users.data.items.map((user) => (
              <Tr key={user.id}>
                <Td>
                  <p className="font-medium">{user.name || user.email}</p>
                  <p className="text-muted-foreground">{user.email}</p>
                </Td>
                <Td>
                  <Select aria-label={`Role for ${user.email}`} className="w-32" value={user.role} disabled={user.id === me.id} onChange={(event) => update.mutate({ id: user.id, role: event.target.value as Role })}>
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td>{format.relative(user.lastLoginAt)}</Td>
                <Td>
                  {user.id === me.id ? (
                    <Badge tone="brand">You</Badge>
                  ) : (
                    <Button size="sm" variant={user.status === "active" ? "ghost" : "secondary"} onClick={() => update.mutate({ id: user.id, status: user.status === "active" ? "disabled" : "active" })}>
                      {user.status === "active" ? "Disable" : "Enable"}
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : null}
      <Dialog
        open={inviting}
        onClose={() => setInviting(false)}
        title="Invite a person"
        footer={
          <>
            <Button variant="ghost" onClick={() => setInviting(false)}>
              Cancel
            </Button>
            <Button variant="default" loading={create.isPending} onClick={() => create.mutate()}>
              Send invitation
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Email" error={fieldError(create.error, "email")}>
            {(props) => <Input {...props} type="email" value={invite.email} onChange={(event) => setInvite({ ...invite, email: event.target.value })} />}
          </Field>
          <Field label="Name">{(props) => <Input {...props} value={invite.name} onChange={(event) => setInvite({ ...invite, name: event.target.value })} />}</Field>
          <Field label="Role">
            {(props) => (
              <Select {...props} value={invite.role} onChange={(event) => setInvite({ ...invite, role: event.target.value as Role })}>
                {ROLES.filter((role) => role !== "owner" || me.role === "owner").map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <FormError error={create.error && !fieldError(create.error, "email") ? create.error : null} />
        </div>
      </Dialog>
    </div>
  );
}

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  role: Role;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ApiSettingsPage() {
  const me = useUser();
  const format = useFormat();
  const toast = useToast();
  const queryClient = useQueryClient();
  const tokens = useQuery({ queryKey: ["api-tokens"], queryFn: () => api.get<{ items: ApiToken[] }>("/api/api-tokens") });
  const [form, setForm] = useState({ name: "", role: "member" as Role });
  const [created, setCreated] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiToken | null>(null);
  const create = useMutation({
    mutationFn: () => api.post<{ token: string }>("/api/api-tokens", form),
    onSuccess: (data) => {
      setCreated(data.token);
      setForm({ name: "", role: "member" });
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-tokens/${id}`),
    onSuccess: () => {
      setRevoking(null);
      queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      toast("Token revoked");
    },
  });
  const origin = window.location.origin;
  const mcpConfig = JSON.stringify({ mcpServers: { sistemele: { type: "http", url: `${origin}/mcp`, headers: { Authorization: `Bearer ${created ?? "sk_…"}` } } } }, null, 2);

  return (
    <div className="grid max-w-4xl gap-6">
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Connect an AI agent</h2>
        <p className="mt-1 text-foreground/80">
          Agents use the same permissions as their token. Point any MCP client (Claude, Cursor, Codex) at <code className="rounded bg-muted px-1 font-mono text-sm">{origin}/mcp</code>.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-md bg-foreground p-4 font-mono text-xs leading-relaxed text-white">{mcpConfig}</pre>
        <p className="mt-3 text-sm text-muted-foreground">
          Claude Code: <code className="font-mono">claude mcp add --transport http sistemele {origin}/mcp --header "Authorization: Bearer sk_…"</code>
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="text-lg font-semibold">Create a token</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Field label="Name" className="min-w-56 flex-1" error={fieldError(create.error, "name")}>
            {(props) => <Input {...props} placeholder="Claude on my laptop" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
          </Field>
          <Field label="Access">
            {(props) => (
              <Select {...props} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
                {ROLES.filter((role) => role === "member" || role === me.role || (me.role === "owner" && role === "admin")).map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Button type="submit" variant="default" icon={<KeyRound />} loading={create.isPending}>
            Create token
          </Button>
        </form>
        {created ? (
          <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3">
            <p className="text-sm font-medium text-warning">Copy this token now. It will not be shown again.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-card px-2 py-1 font-mono text-sm">{created}</code>
              <Button variant="outline" size="sm" icon={<Copy />} onClick={() => navigator.clipboard.writeText(created).then(() => toast("Copied"))}>
                Copy
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {tokens.data?.items.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Token</Th>
              <Th>Access</Th>
              <Th>Last used</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {tokens.data.items.map((token) => (
              <Tr key={token.id}>
                <Td>
                  <p className="font-medium">{token.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{token.prefix}…</p>
                </Td>
                <Td>{token.role}</Td>
                <Td>{format.relative(token.lastUsedAt)}</Td>
                <Td align="right">
                  <Button size="sm" variant="ghost" onClick={() => setRevoking(token)}>
                    Revoke
                  </Button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : tokens.isSuccess ? (
        <EmptyState title="No API tokens yet" description="Create one to connect an agent or a script." />
      ) : null}
      <ConfirmDialog
        open={Boolean(revoking)}
        title="Revoke token?"
        message={`Agents and scripts using "${revoking?.name}" stop working immediately.`}
        confirmLabel="Revoke token"
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking.id)}
        onClose={() => setRevoking(null)}
      />
    </div>
  );
}

export function EmailSettingsPage() {
  const info = useAppInfo();
  const format = useFormat();
  const log = useQuery({ queryKey: ["email-log"], queryFn: () => api.get<{ items: Array<{ id: string; to: string; subject: string; template: string; status: string; error: string | null; createdAt: string }> }>("/api/email-log") });
  return (
    <div className="grid max-w-5xl gap-6">
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Resend</h2>
          {info?.emailConfigured ? <Badge tone="success">Connected</Badge> : <Badge tone="warning">Not connected</Badge>}
        </div>
        {info?.emailConfigured ? (
          <p className="mt-1 text-foreground/80">Emails go out through Resend. Every attempt is listed below.</p>
        ) : (
          <div className="mt-2 grid gap-2 text-foreground/80">
            <p>Emails are printed to the Worker log instead of being sent. To send real email:</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Create an API key at resend.com and verify your sending domain.</li>
              <li>
                Run <code className="rounded bg-muted px-1 font-mono">npx wrangler secret put RESEND_API_KEY</code>.
              </li>
              <li>
                Set <code className="rounded bg-muted px-1 font-mono">EMAIL_FROM</code> in wrangler.jsonc to an address on that domain, then deploy.
              </li>
            </ol>
          </div>
        )}
      </Card>
      {log.data?.items.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Sent</Th>
              <Th>To</Th>
              <Th>Subject</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {log.data.items.map((item) => (
              <Tr key={item.id}>
                <Td className="whitespace-nowrap">{format.dateTime(item.createdAt)}</Td>
                <Td>{item.to}</Td>
                <Td>
                  <p>{item.subject}</p>
                  <p className="font-mono text-xs text-muted-foreground">{item.template}</p>
                  {item.error ? <p className="text-xs text-destructive">{item.error}</p> : null}
                </Td>
                <Td>
                  <Badge tone={item.status === "sent" ? "success" : item.status === "failed" ? "danger" : "neutral"}>{item.status}</Badge>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      ) : log.isSuccess ? (
        <EmptyState title="No emails yet" />
      ) : null}
    </div>
  );
}

export function AuditSettingsPage() {
  const format = useFormat();
  const log = useQuery({ queryKey: ["audit"], queryFn: () => api.get<{ items: Array<{ id: string; actor: string; action: string; summary: string; createdAt: string }> }>("/api/audit?limit=200") });
  if (log.isLoading) return <Spinner />;
  if (log.error) return <ErrorState error={log.error} />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>When</Th>
          <Th>Who</Th>
          <Th>What</Th>
        </tr>
      </thead>
      <tbody>
        {log.data?.items.map((item) => (
          <Tr key={item.id}>
            <Td className="whitespace-nowrap">{format.dateTime(item.createdAt)}</Td>
            <Td>{item.actor}</Td>
            <Td>
              <p>{item.summary}</p>
              <p className="font-mono text-xs text-muted-foreground">{item.action}</p>
            </Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}

export function ModulesSettingsPage() {
  const info = useAppInfo();
  return (
    <div className="grid max-w-3xl gap-4">
      <p className="text-foreground/80">
        Modules are switched on in <code className="rounded bg-muted px-1 font-mono text-sm">sistemele.config.ts</code>. Ask your coding agent: “enable the invoices module” or “create a module for bookings”.
      </p>
      <ul className="grid gap-2">
        {info?.modules.map((module) => (
          <li key={module.id}>
            <Card className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{module.name}</p>
                <p className="text-sm text-muted-foreground">{module.description}</p>
              </div>
              <Badge tone="success">On</Badge>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
