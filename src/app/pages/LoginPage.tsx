import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { api, fieldError } from "../lib/api";
import { useBrandInfo } from "../lib/brand";
import { useSession } from "../lib/session";
import { Button, Field, FormError, Input, Spinner } from "../ui";

function AuthFrame({ children }: { children: React.ReactNode }) {
  const brand = useBrandInfo();
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex min-h-8 items-center gap-2 font-semibold">
          {brand?.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="h-8 w-auto max-w-[220px]" />
          ) : (
            <>
              <img src="/favicon.svg" alt="" className="size-7" />
              {brand?.name ?? "Sistemėlė"}
            </>
          )}
        </div>
        {children}
      </div>
    </main>
  );
}

export function LoginPage() {
  const { user, demo } = useSession();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const request = useMutation({ mutationFn: (value: string) => api.post<{ ok: true; devLink?: string }>("/api/auth/link", { email: value }) });

  if (user) return <Navigate to={params.get("next") ?? "/app"} replace />;
  if (demo) return <DemoLogin />;

  if (request.isSuccess) {
    return (
      <AuthFrame>
        <MailCheck className="mb-4 size-8 text-brand" />
        <h1 className="text-2xl font-semibold">Check your email</h1>
        <p className="mt-2 text-ink-soft">
          If <strong>{email}</strong> has access, a sign-in link is on its way. It works once, for 15 minutes.
        </p>
        {request.data.devLink ? (
          <div className="mt-6 rounded-control border border-dashed border-warning/50 bg-warning-soft p-3 text-sm">
            <p className="font-medium text-warning">Local development: email is not configured.</p>
            <a className="mt-1 block font-medium break-all text-brand underline" href={request.data.devLink}>
              Open the sign-in link
            </a>
          </div>
        ) : null}
        <Button variant="ghost" className="mt-6 -ml-4" onClick={() => request.reset()}>
          Use another email
        </Button>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 text-ink-soft">We email you a one-time link. No password to remember.</p>
      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          request.mutate(email);
        }}
      >
        <Field label="Work email" error={fieldError(request.error, "email")}>
          {(props) => <Input {...props} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />}
        </Field>
        {request.error && !fieldError(request.error, "email") ? <FormError error={request.error} /> : null}
        <Button type="submit" variant="primary" loading={request.isPending}>
          Email me a sign-in link
        </Button>
      </form>
    </AuthFrame>
  );
}

/** Public demo: one button, no email. */
function DemoLogin() {
  const queryClient = useQueryClient();
  const open = useMutation({ mutationFn: () => api.post<{ ok: true }>("/api/auth/demo"), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["session"] }) });
  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold">Try the demo</h1>
      <p className="mt-2 text-ink-soft">A sample business with customers, products, quotes, invoices and a website. Change anything: the data resets every hour, and no email is sent.</p>
      <Button variant="primary" className="mt-6 w-full" loading={open.isPending || open.isSuccess} onClick={() => open.mutate()}>
        Open the demo
      </Button>
      <FormError error={open.error} />
    </AuthFrame>
  );
}

export function VerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = params.get("token") ?? "";
  const started = useRef(false);
  const verify = useMutation({
    mutationFn: () => api.post("/api/auth/verify", { token }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate("/app", { replace: true });
    },
  });
  useEffect(() => {
    if (started.current || !token) return;
    started.current = true;
    verify.mutate();
  }, [token, verify]);

  return (
    <AuthFrame>
      {verify.isError || !token ? (
        <>
          <h1 className="text-2xl font-semibold">This link does not work</h1>
          <FormError error={verify.error ?? new Error("The link is incomplete. Request a new one.")} />
          <Button variant="primary" className="mt-6" onClick={() => navigate("/app/login")}>
            Request a new link
          </Button>
        </>
      ) : (
        <Spinner label="Signing you in" />
      )}
    </AuthFrame>
  );
}
