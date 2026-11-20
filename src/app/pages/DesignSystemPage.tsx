import { ArrowLeft, Inbox, Moon, Plus, Sun, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BrandLockup } from "../components/BrandLockup";
import { useTheme } from "../lib/theme";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CheckboxField,
  ConfirmDialog,
  DetailList,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  IconButton,
  Input,
  MoneyInput,
  PageHeader,
  Select,
  Skeleton,
  Spinner,
  Table,
  Td,
  Textarea,
  Th,
  Tr,
  useToast,
} from "../ui";

/**
 * Live design system reference at /app/design (public, noindex). Renders the
 * real tokens and components, so it never drifts from the kit. Written rules:
 * DESIGN.md and docs/design-system.md.
 */

const colorTokens: Array<{ name: string; className: string; use: string }> = [
  { name: "background", className: "bg-background", use: "Page ground" },
  { name: "foreground", className: "bg-foreground", use: "Body text, strong icons" },
  { name: "card", className: "bg-card", use: "Cards, tables, inputs" },
  { name: "muted", className: "bg-muted", use: "Quiet fills, table header" },
  { name: "muted-foreground", className: "bg-muted-foreground", use: "Secondary text, labels" },
  { name: "accent", className: "bg-accent", use: "Hover and selected rows" },
  { name: "border", className: "bg-border", use: "Dividers, card edges" },
  { name: "input", className: "bg-input", use: "Control borders" },
  { name: "primary", className: "bg-primary", use: "Brand: one primary action, links, focus" },
  { name: "destructive", className: "bg-destructive", use: "Delete, void, overdue" },
  { name: "success", className: "bg-success", use: "Paid, won, accepted" },
  { name: "warning", className: "bg-warning", use: "Due soon, sent, low stock" },
  { name: "info", className: "bg-info", use: "Neutral notices, new" },
];

const typeScale: Array<{ label: string; className: string; spec: string; sample: string }> = [
  { label: "Page title", className: "text-2xl font-semibold tracking-tight", spec: "24 / 600 / -0.015em", sample: "Leads" },
  { label: "Section", className: "text-lg font-semibold tracking-tight", spec: "18 / 600", sample: "Work this lead" },
  { label: "Card title", className: "text-sm font-semibold", spec: "14 / 600", sample: "Timeline" },
  { label: "Body", className: "text-sm", spec: "14 / 400 / 1.5", sample: "Website messages land here as leads." },
  { label: "Secondary", className: "text-sm text-muted-foreground", spec: "14 / muted-foreground", sample: "Agrotech UAB · Event" },
  { label: "Meta", className: "text-xs text-muted-foreground", spec: "12 / muted-foreground", sample: "Created 4 Nov 2026" },
  { label: "Numbers", className: "tabular text-2xl font-semibold tracking-tight", spec: "tabular-nums, right-aligned in tables", sample: "€18,350.00" },
];

const sections = [
  { id: "brand", label: "Brand" },
  { id: "foundations", label: "Foundations" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Forms" },
  { id: "status", label: "Status" },
  { id: "surfaces", label: "Surfaces" },
  { id: "feedback", label: "Feedback" },
  { id: "rules", label: "Rules" },
];

export default function DesignSystemPage() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [checked, setChecked] = useState(true);
  const [amount, setAmount] = useState<number | null>(125000);
  const [theme, setTheme] = useTheme();

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/app" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-6" />
            Sistemėlė
            <span className="font-normal text-muted-foreground">/ Design system</span>
          </Link>
          <div className="flex items-center gap-1">
            <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                  {section.label}
                </a>
              ))}
            </nav>
            <IconButton label={theme === "dark" ? "Use light mode" : "Use dark mode"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun /> : <Moon />}
            </IconButton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <PageHeader
          back={
            <Link to="/app" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" /> Admin panel
            </Link>
          }
          title="Design system"
          description="shadcn/ui components on one set of tokens, shared by the admin panel and the public site. Light is the default; the admin panel has a dark mode switch (the moon, top right here and in the sidebar). Settings → Brand changes the logo, primary colour, surfaces and corners."
        />

        <Section id="brand" title="Brand" lead="The mark is a wheel built from six modules around a hub: the wheel your agent does not reinvent. The tinted module, top right, is the one you add.">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: "On the page", className: "bg-background" },
              { label: "On a card", className: "bg-card" },
              { label: "In dark mode", className: "dark bg-background text-foreground" },
            ].map((surface) => (
              <figure key={surface.label} className={`grid place-items-center gap-5 rounded-xl border p-8 ${surface.className}`}>
                <img src="/favicon.svg" alt="" className="size-20" />
                <BrandLockup brand={{ name: "Sistemėlė", logoUrl: null, logoMark: true, brandColor: "#1f5f4a" }} />
                <figcaption className="text-xs text-muted-foreground">{surface.label}</figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Use it like this" />
              <CardContent>
                <ul className="grid gap-3 text-sm">
                  {[
                    ["Lockup", "Mark plus the business name in Inter 650, gap ⅓ of the mark. The panel and the site build it for any square logo."],
                    ["Clear space", "A quarter of the mark on every side. Nothing else inside it."],
                    ["Smallest size", "16 px as a favicon, 24 px in the interface, 30 px in the site header."],
                    ["Colour", "Brand-colour tile, white modules, the added module at 50% white. Keep the tile on photos and busy backgrounds."],
                    ["Your own logo", "Settings → Brand. A square SVG is treated as a mark (name set beside it); a wide one already carries the name and shows alone."],
                  ].map(([title, text]) => (
                    <li key={title} className="grid gap-0.5 sm:grid-cols-[110px_1fr] sm:gap-4">
                      <span className="font-medium">{title}</span>
                      <span className="text-muted-foreground">{text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Not like this" />
              <CardContent>
                <ul className="grid gap-3 text-sm">
                  {[
                    ["Recolour modules", "One tile colour, white modules. No rainbow segments."],
                    ["Rotate or stretch", "The added module stays top right; the mark stays square."],
                    ["Drop the tile", "The modules alone read as a pie chart."],
                    ["Add effects", "No shadows, gradients, outlines or glows on the mark."],
                    ["Another typeface", "The name is set in Inter, never baked into the image as text."],
                  ].map(([title, text]) => (
                    <li key={title} className="grid gap-0.5 sm:grid-cols-[130px_1fr] sm:gap-4">
                      <span className="font-medium text-destructive">{title}</span>
                      <span className="text-muted-foreground">{text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Files: <code className="rounded bg-muted px-1">public/favicon.svg</code> is the default mark (also the browser tab icon); the demo uses the same SVG as its logo in{" "}
            <code className="rounded bg-muted px-1">seed/01_core.sql</code>.
          </p>
        </Section>

        <Section id="foundations" title="Foundations" lead="Use token names, never raw colours. Tailwind classes map one to one: bg-card, text-muted-foreground, border-border.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colorTokens.map((token) => (
              <li key={token.name} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <span className={`size-10 shrink-0 rounded-md border ${token.className}`} aria-hidden />
                <span className="min-w-0">
                  <code className="block text-sm font-medium">--{token.name}</code>
                  <span className="block truncate text-xs text-muted-foreground">{token.use}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
            <Card>
              <CardHeader title="Type" description="Inter Variable, self-hosted. One family, weight and size do the work." />
              <ul className="divide-y">
                {typeScale.map((row) => (
                  <li key={row.label} className="grid gap-1 px-5 py-3 sm:grid-cols-[120px_1fr_auto] sm:items-baseline sm:gap-4">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className={row.className}>{row.sample}</span>
                    <code className="text-xs text-muted-foreground">{row.spec}</code>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Radius and elevation" description="--radius drives the scale; Brand → Corners changes it." />
              <CardContent className="grid gap-6">
                <div className="flex flex-wrap items-end gap-4">
                  {[
                    ["sm", "rounded-sm"],
                    ["md", "rounded-md"],
                    ["lg", "rounded-lg"],
                    ["xl", "rounded-xl"],
                  ].map(([label, className]) => (
                    <div key={label} className="grid justify-items-center gap-2">
                      <span className={`size-14 border-2 border-foreground/70 bg-muted ${className}`} />
                      <code className="text-xs text-muted-foreground">{label}</code>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-4">
                  {[
                    ["shadow-xs", "Controls, cards"],
                    ["shadow-sm", "Raised cards"],
                    ["shadow-lg", "Dialogs, menus"],
                  ].map(([className, label]) => (
                    <div key={className} className={`grid w-28 gap-1 rounded-lg border bg-card p-3 ${className}`}>
                      <code className="text-xs font-medium">{className.replace("shadow-", "")}</code>
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </Section>

        <Section id="buttons" title="Buttons" lead="One primary action per screen, top right. Name the button after the result: Create invoice, not Submit.">
          <Card>
            <CardContent className="grid gap-6">
              <Row label="Variants">
                <Button>Create invoice</Button>
                <Button variant="outline">Cancel</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button variant="destructive">Void invoice</Button>
              </Row>
              <Row label="Sizes and states">
                <Button size="sm" icon={<Plus />}>
                  New lead
                </Button>
                <Button icon={<Plus />}>New lead</Button>
                <Button size="lg">Deploy</Button>
                <Button loading>Saving</Button>
                <Button variant="outline" disabled>
                  Disabled
                </Button>
                <IconButton label="Remove line">
                  <Trash2 />
                </IconButton>
              </Row>
            </CardContent>
          </Card>
        </Section>

        <Section id="forms" title="Forms" lead="Labels above fields, the server's message under the field, one submit button named after the result.">
          <Card>
            <CardHeader title="New lead" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Name">{(props) => <Input {...props} defaultValue="Rūta Kazlauskienė" />}</Field>
              <Field label="Email" error="Enter a valid email.">
                {(props) => <Input {...props} defaultValue="ruta@" />}
              </Field>
              <Field label="Source">
                {(props) => (
                  <Select {...props} defaultValue="referral">
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                    <option value="event">Event</option>
                  </Select>
                )}
              </Field>
              <Field label="Estimated value (net)" hint="In euros; saved as integer cents.">
                {(props) => <MoneyInput {...props} value={amount} onValueChange={setAmount} />}
              </Field>
              <Field label="What they need" className="sm:col-span-2">
                {(props) => <Textarea {...props} placeholder="Quantities, dates, anything that helps price it." />}
              </Field>
              <div className="sm:col-span-2">
                <CheckboxField label="Open a deal" hint="Creates a deal in the first open stage." checked={checked} onChange={setChecked} />
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="outline">Cancel</Button>
              <Button>Create lead</Button>
            </CardFooter>
          </Card>
        </Section>

        <Section id="status" title="Status" lead="Status is a badge with a tone. The same tone means the same thing in every module.">
          <Card>
            <CardContent className="grid gap-4">
              <Row label="Tones">
                <Badge tone="neutral">Draft</Badge>
                <Badge tone="info">New</Badge>
                <Badge tone="warning">Sent</Badge>
                <Badge tone="success">Paid</Badge>
                <Badge tone="danger">Overdue</Badge>
                <Badge tone="brand">Qualified</Badge>
                <Badge tone="outline">Archived</Badge>
              </Row>
            </CardContent>
          </Card>
        </Section>

        <Section id="surfaces" title="Surfaces" lead="Cards hold related content with a header row; tables scroll inside their card on phones; dialogs are for create and edit forms.">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_440px]">
            <Table>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th className="hidden sm:table-cell">Customer</Th>
                  <Th>Status</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["INV-2026-0003", "Ona Petraitė", "warning", "Sent", "€48.40"],
                  ["INV-2026-0002", "Greenhouse Farms", "success", "Paid", "€5,082.00"],
                  ["INV-2026-0001", "Baltic Build UAB", "danger", "Overdue", "€1,500.40"],
                ].map(([number, customer, tone, label, total]) => (
                  <Tr key={number}>
                    <Td className="font-medium">{number}</Td>
                    <Td className="hidden sm:table-cell">{customer}</Td>
                    <Td>
                      <Badge tone={tone as "warning" | "success" | "danger"}>{label}</Badge>
                    </Td>
                    <Td align="right">{total}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Card>
              <CardHeader title="Details" actions={<Button size="sm" variant="outline" onClick={() => setDialog(true)}>Open dialog</Button>} />
              <CardContent>
                <DetailList
                  items={[
                    { label: "Email", value: "tomas@agrotech.example" },
                    { label: "Phone", value: "+370 655 55555" },
                    { label: "Company", value: "Agrotech UAB" },
                    { label: "Owner", value: "" },
                  ]}
                />
              </CardContent>
              <CardFooter>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                  Archive…
                </Button>
              </CardFooter>
            </Card>
          </div>
        </Section>

        <Section id="feedback" title="Feedback" lead="Every list has loading, empty and error states. Empty states say what to do next.">
          <div className="grid gap-6 lg:grid-cols-2">
            <EmptyState
              icon={<Inbox />}
              title="No open leads"
              description="Website requests land here. Add one you heard about elsewhere."
              action={
                <Button icon={<Plus />} onClick={() => toast("Lead created")}>
                  New lead
                </Button>
              }
            />
            <div className="grid content-start gap-4">
              <ErrorState error={new Error("Could not load leads. Check your connection.")} retry={() => toast("Retrying")} />
              <FormError error={new Error("Say why the lead is disqualified.")} />
              <Card>
                <CardContent className="grid gap-3">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
              <div className="flex items-center gap-3">
                <Spinner label="Loading" />
                <Button variant="outline" onClick={() => toast("Saved")}>
                  Show a toast
                </Button>
              </div>
            </div>
          </div>
        </Section>

        <Section id="rules" title="Rules" lead="The short version of DESIGN.md. Agents: read docs/design-system.md before adding UI.">
          <ol className="grid border-t sm:grid-cols-2 sm:gap-x-10">
            {[
              ["Use the kit", "Import from @/app/ui. Add missing shadcn components with npx shadcn@latest add <name>; they land in src/app/ui."],
              ["Tokens only", "No hex values or Tailwind palette colours in components. Brand colour comes from Settings → Brand."],
              ["One primary action", "Per screen, top right in the page header. Everything else is outline or ghost."],
              ["Lines before shadows", "Borders structure the page. Shadows only lift cards slightly and float dialogs and menus."],
              ["Numbers are tabular", "Money and quantities use the tabular class and align right in tables."],
              ["Every state", "Loading, empty, error and success for every list and form, at phone and desktop width."],
            ].map(([title, text]) => (
              <li key={title} className="flex gap-4 border-b py-4">
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </main>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="New deal"
        description="Dialogs hold short create and edit forms."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => (setDialog(false), toast("Deal created"))}>Create deal</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Title">{(props) => <Input {...props} placeholder="Warehouse shelving" />}</Field>
          <Field label="Value (net)">{(props) => <MoneyInput {...props} value={amount} onValueChange={setAmount} />}</Field>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        title="Archive Agrotech UAB?"
        message="The contact leaves lists and search. Its deals, quotes and invoices stay."
        confirmLabel="Archive contact"
        onConfirm={() => (setConfirm(false), toast("Contact archived"))}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t py-10 first-of-type:border-t-0 first-of-type:pt-4">
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-1 mb-6 max-w-2xl text-sm text-muted-foreground">{lead}</p>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[120px_1fr] sm:items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
