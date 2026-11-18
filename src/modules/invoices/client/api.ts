import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/shared/api";
import type { BusinessProfile } from "@/shared/business";
import { api, queryString } from "@/app/lib/api";
import type { Invoice, InvoiceActionResult, InvoiceDetail, InvoiceFilter, InvoiceInput, IssueInput, PaymentInput } from "../shared/schema";

/** Invoice data hooks. Query keys start with "invoices" so one invalidate refreshes the module. */
export const invoiceKeys = {
  all: ["invoices"] as const,
  list: (params: object) => ["invoices", "list", params] as const,
  detail: (id: string) => ["invoices", "detail", id] as const,
};

export interface InvoiceListParams {
  status?: InvoiceFilter;
  contactId?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function useInvoices(params: InvoiceListParams) {
  return useQuery({ queryKey: invoiceKeys.list(params), queryFn: () => api.get<Page<Invoice>>(`/api/invoices${queryString({ ...params })}`), placeholderData: (previous) => previous });
}

export function useInvoice(id: string) {
  return useQuery({ queryKey: invoiceKeys.detail(id), queryFn: () => api.get<InvoiceDetail>(`/api/invoices/${id}`), enabled: Boolean(id) });
}

/** Seller defaults (VAT rate, payment terms). Same key as Settings → Business. */
export function useBusiness() {
  return useQuery({ queryKey: ["settings", "business"], queryFn: () => api.get<{ business: BusinessProfile }>("/api/settings/business"), staleTime: 60_000 });
}

/** Refresh lists, numbers and the CRM timeline (issue and payment events write to it). */
function useRefresh() {
  const queryClient = useQueryClient();
  return (invoice?: InvoiceDetail) => {
    if (invoice) queryClient.setQueryData(invoiceKeys.detail(invoice.id), invoice);
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: invoiceKeys.all }),
      queryClient.invalidateQueries({ queryKey: ["metrics"] }),
      queryClient.invalidateQueries({ queryKey: ["crm"] }),
    ]);
  };
}

export function useSaveInvoice(id?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: InvoiceInput) => (id ? api.patch<InvoiceDetail>(`/api/invoices/${id}`, input) : api.post<InvoiceDetail>("/api/invoices", input)),
    onSuccess: (invoice) => refresh(invoice),
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/invoices/${id}`),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: invoiceKeys.detail(id) });
      return Promise.all([queryClient.invalidateQueries({ queryKey: invoiceKeys.all }), queryClient.invalidateQueries({ queryKey: ["metrics"] })]);
    },
  });
}

export function useIssueInvoice(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (input: IssueInput) => api.post<InvoiceActionResult>(`/api/invoices/${id}/issue`, input), onSuccess: (result) => refresh(result.invoice) });
}

export function useSendInvoice(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: () => api.post<InvoiceActionResult>(`/api/invoices/${id}/send`), onSuccess: (result) => refresh(result.invoice) });
}

export function useRecordPayment(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (input: PaymentInput) => api.post<InvoiceDetail>(`/api/invoices/${id}/payments`, input), onSuccess: (invoice) => refresh(invoice) });
}

export function useDeletePayment(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (paymentId: string) => api.delete<InvoiceDetail>(`/api/invoices/${id}/payments/${paymentId}`), onSuccess: (invoice) => refresh(invoice) });
}

export function useVoidInvoice(id: string) {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (reason: string) => api.post<InvoiceDetail>(`/api/invoices/${id}/void`, { reason }), onSuccess: (invoice) => refresh(invoice) });
}
