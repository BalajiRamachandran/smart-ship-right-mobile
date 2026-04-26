import { api } from './client';

export type MoveHistoryItem = {
  id: string;
  sku_id: string;
  sku_code: string;
  sku_name: string;
  from_location_id: string;
  from_location_name: string;
  to_location_id: string;
  to_location_name: string;
  quantity: number;
  moved_by: string;
  moved_by_username: string;
  moved_at: string;
  reason?: string;
  notes?: string;
};

export type MoveHistoryResponse = {
  items?: MoveHistoryItem[];
  total?: number;
};

export async function fetchMoveHistory(params: {
  skip: number;
  limit: number;
  search?: string;
}): Promise<{ items: MoveHistoryItem[]; total: number }> {
  const res = await api.get<MoveHistoryResponse>('/api/inventory/move-history', {
    params: {
      skip: params.skip,
      limit: params.limit,
      search: params.search?.trim() || undefined,
    },
  });
  const data = res.data ?? {};
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: typeof data.total === 'number' ? data.total : 0,
  };
}
