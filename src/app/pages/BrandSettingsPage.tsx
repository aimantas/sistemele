import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clsx } from "clsx";
import { AlertTriangle, Check, FileUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { BRAND_PRESETS, brandTokens, CORNERS, SURFACES, type Branding } from "@/shared/branding";
import { api, fieldError } from "../lib/api";
import { useRefreshBrand } from "../lib/brand";
import { useCan } from "../lib/session";
import { Badge, Button, Card, ErrorState, Field, FormError, Input, Spinner, Textarea, useToast } from "../ui";

const MAX_LOGO_BYTES = 100_000;

/** Settings → Brand: SVG logo, brand colour, surface tone, corner style, live preview. */
export function BrandSettingsPage() {
  const isAdmin = useCan("admin");
  const toast = useToast();
  const queryClient = useQueryClient();
  const refreshBrand = useRefreshBrand();
  const fileRef = useRef<HTMLInputElement>(null);
  const query = useQuery({ queryKey: ["settings", "branding"], queryFn: () => api.get<{ branding: Branding; logoUrl: string | null }>("/api/settings/branding") });
  const [form, setForm] = useState<Branding | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (branding: Branding) => api.put<{ branding: Branding; logoUrl: string | null }>("/api/settings/branding", branding),
    onSuccess: async (data) => {
      queryClient.setQueryData(["settings", "branding"], data);
      setForm(null);
      await refreshBrand();
      toast("Brand saved");
    },
  });

  if (query.isLoading) return <Spinner />;
  if (query.error || !query.data) return <ErrorState error={query.error} retry={() => query.refetch()} />;
  const value = form ?? query.data.branding;
  const set = (patch: Partial<Branding>) => setForm({ ...value, ...patch });
  const tokens = brandTokens(value);
  const logoPreview = value.logoSvg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(value.logoSvg)}` : null;
  const tooLight = tokens.contrast.asText < 4.5;

  const readFile = async (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") return setFileError("Choose an .svg file.");
    if (file.size > MAX_LOGO_BYTES) return setFileError("The SVG is larger than 100 KB. Minify it (for example with SVGOMG) and try again.");
    set({ logoSvg: await file.text() });
  };

  return (
    <form
      className="grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(value);
      }}
    >
      <div className="grid content-start gap-6">
        <Card className="grid gap-4 p-5">
          <div>
            <h2 className="text-lg font-semibold">Logo</h2>
            <p className="text-sm text-muted-foreground">SVG only, up to 100 KB. It is read in your browser and saved as text — no file upload. Shown in the dashboard, on the public site and on quotes and invoices.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-20 w-56 place-items-center rounded-md border border-dashed border-input bg-card p-3">
              {logoPreview ? <img src={logoPreview} alt="Logo preview" className="max-h-full max-w-full" /> : <span className="text-sm text-muted-foreground">No logo yet</span>}
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept=".svg,image/svg+xml" className="sr-only" aria-label="Choose an SVG logo file" onChange={(event) => void readFile(event.target.files?.[0])} />
                <Button variant="outline" icon={<FileUp />} onClick={() => fileRef.current?.click()}>
                  Choose SVG file
                </Button>
                {value.logoSvg ? (
                  <Button variant="ghost" icon={<Trash2 />} onClick={() => set({ logoSvg: null })}>
                    Remove logo
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
          {isAdmin ? (
            <Field label="Or paste SVG markup" error={fieldError(save.error, "logoSvg")} hint="Scripts, event handlers and external links are removed when you save.">
              {(props) => <Textarea {...props} rows={4} className="font-mono text-xs" placeholder='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32">…</svg>' value={value.logoSvg ?? ""} onChange={(event) => set({ logoSvg: event.target.value || null })} />}
            </Field>
          ) : null}
        </Card>

        <Card className="grid gap-4 p-5">
          <h2 className="text-lg font-semibold">Brand colour</h2>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour presets">
            {BRAND_PRESETS.map((preset) => {
              const selected = value.brandColor === preset.color;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!isAdmin}
                  onClick={() => set({ brandColor: preset.color })}
                  className={clsx("flex items-center gap-2 rounded-full border py-1 pr-3 pl-1 text-sm", selected ? "border-foreground" : "border-border hover:border-input")}
                >
                  <span className="grid size-6 place-items-center rounded-full text-white" style={{ background: preset.color }}>
                    {selected ? <Check className="size-3.5" /> : null}
                  </span>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Custom colour" error={fieldError(save.error, "brandColor")}>
              {(props) => (
                <div className="flex items-center gap-2">
                  <input type="color" aria-label="Pick a brand colour" disabled={!isAdmin} value={value.brandColor} onChange={(event) => set({ brandColor: event.target.value })} className="h-10 w-12 cursor-pointer rounded-md border border-input bg-card p-1" />
                  <Input {...props} disabled={!isAdmin} className="w-32 font-mono" value={value.brandColor} maxLength={7} onChange={(event) => set({ brandColor: event.target.value })} />
                </div>
              )}
            </Field>
            {tooLight ? (
              <p className="flex items-center gap-1.5 pb-2 text-sm text-warning">
                <AlertTriangle className="size-4" /> Too light for text on white ({tokens.contrast.asText.toFixed(1)}:1). Pick a darker shade for links and labels to stay readable.
              </p>
            ) : (
              <p className="pb-2 text-sm text-muted-foreground">Contrast {tokens.contrast.asText.toFixed(1)}:1 on white — readable.</p>
            )}
          </div>
        </Card>

        <Card className="grid gap-5 p-5 sm:grid-cols-2">
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-lg font-semibold">Background</legend>
            {(Object.keys(SURFACES) as Array<keyof typeof SURFACES>).map((key) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary">
                <input type="radio" name="surface" disabled={!isAdmin} checked={value.surface === key} onChange={() => set({ surface: key })} className="accent-primary" />
                <span className="size-5 rounded border border-input" style={{ background: SURFACES[key].background }} />
                {SURFACES[key].label}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-lg font-semibold">Corners</legend>
            {(Object.keys(CORNERS) as Array<keyof typeof CORNERS>).map((key) => (
              <label key={key} className="flex cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-[:checked]:border-primary">
                <input type="radio" name="corners" disabled={!isAdmin} checked={value.corners === key} onChange={() => set({ corners: key })} className="accent-primary" />
                <span className="size-5 border-2 border-foreground/60" style={{ borderRadius: CORNERS[key].radius }} />
                {CORNERS[key].label}
              </label>
            ))}
          </fieldset>
        </Card>

        <FormError error={save.error && !fieldError(save.error, "logoSvg") && !fieldError(save.error, "brandColor") ? save.error : null} />
        {isAdmin ? (
          <div className="flex gap-2">
            <Button type="submit" variant="default" loading={save.isPending} disabled={!form}>
              Save brand
            </Button>
            {form ? (
              <Button variant="ghost" onClick={() => setForm(null)}>
                Discard changes
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Only owners and admins can change the brand.</p>
        )}
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start" aria-label="Preview">
        <p className="mb-2 text-sm font-medium text-muted-foreground">Preview (light mode)</p>
        <div className="overflow-hidden border" style={{ background: tokens.background, borderColor: tokens.border, borderRadius: `calc(${tokens.radius} + 4px)` }}>
          <div className="flex items-center gap-2 border-b px-4 py-3" style={{ background: "#fff", borderColor: tokens.border }}>
            {logoPreview ? <img src={logoPreview} alt="" className="h-6 w-auto max-w-32" /> : <span className="size-6 rounded" style={{ background: tokens.brand }} />}
          </div>
          <div className="grid gap-3 p-4">
            <div className="px-2 py-1.5 text-sm font-medium" style={{ background: tokens.brandSoft, color: tokens.brand, borderRadius: `calc(${tokens.radius} - 2px)` }}>
              Dashboard
            </div>
            <div className="border bg-white p-3" style={{ borderColor: tokens.border, borderRadius: `calc(${tokens.radius} + 4px)` }}>
              <p className="text-xs text-muted-foreground">Open pipeline</p>
              <p className="tabular text-xl font-semibold">€28,850.00</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-2 text-sm font-medium" style={{ background: tokens.brand, color: tokens.brandInk, borderRadius: `calc(${tokens.radius} - 2px)` }}>
                Create invoice
              </span>
              <span className="border bg-white px-3 py-2 text-sm font-medium" style={{ borderColor: tokens.input, borderRadius: `calc(${tokens.radius} - 2px)` }}>
                Cancel
              </span>
            </div>
            <p className="text-sm">
              <span style={{ color: tokens.brand }} className="font-medium underline">
                A link in your colour
              </span>
            </p>
            <Badge tone="success" className="w-fit">
              Paid
            </Badge>
          </div>
        </div>
      </aside>
    </form>
  );
}
