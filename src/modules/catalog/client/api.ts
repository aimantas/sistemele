import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Page } from "@/shared/api";
import { api, queryString } from "@/app/lib/api";
import type { Movement, MovementInput, MovementResult, Product, ProductDetail, ProductInput, ProductPatch } from "../shared/schema";

/** Catalog data hooks. Query keys start with "catalog" so one invalidate refreshes the module (and the line editor's suggestions). */
export const catalogKeys = {
  all: ["catalog"] as const,
  products: (params: object) => ["catalog", "products", params] as const,
  product: (id: string) => ["catalog", "product", id] as const,
  movements: (params: object) => ["catalog", "movements", params] as const,
};

export interface ProductListParams {
  q?: string;
  status?: "active" | "archived";
  kind?: "product" | "service";
  lowStock?: 1;
  limit?: number;
  offset?: number;
}

export function useProducts(params: ProductListParams) {
  return useQuery({ queryKey: catalogKeys.products(params), queryFn: () => api.get<Page<Product>>(`/api/catalog/products${queryString({ ...params })}`), placeholderData: (previous) => previous });
}

export function useProduct(id: string) {
  return useQuery({ queryKey: catalogKeys.product(id), queryFn: () => api.get<ProductDetail>(`/api/catalog/products/${id}`) });
}

export function useMovements(params: { productId?: string; limit?: number } = {}) {
  return useQuery({ queryKey: catalogKeys.movements(params), queryFn: () => api.get<{ items: Movement[] }>(`/api/catalog/movements${queryString(params)}`).then((data) => data.items) });
}

function useInvalidateCatalog() {
  const queryClient = useQueryClient();
  return () => Promise.all([queryClient.invalidateQueries({ queryKey: catalogKeys.all }), queryClient.invalidateQueries({ queryKey: ["metrics"] })]);
}

export function useCreateProduct() {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: (input: ProductInput) => api.post<Product>("/api/catalog/products", input), onSuccess: invalidate });
}

export function useUpdateProduct(id: string) {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: (patch: ProductPatch) => api.patch<Product>(`/api/catalog/products/${id}`, patch), onSuccess: invalidate });
}

export function useSetProductStatus(id: string) {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: (action: "archive" | "restore") => api.post<Product>(`/api/catalog/products/${id}/${action}`), onSuccess: invalidate });
}

export function useRecordMovement(productId: string) {
  const invalidate = useInvalidateCatalog();
  return useMutation({ mutationFn: (input: MovementInput) => api.post<MovementResult>(`/api/catalog/products/${productId}/movements`, input), onSuccess: invalidate });
}
