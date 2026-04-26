import { api } from './client';

export type ReportItemHospitalDuringPickingRequest = {
  batch_item_id: string;
  sku_id: string;
  location_id: string;
  quantity_affected: number;
  issue_type: string;
  severity: string;
  description: string;
  picker_notes?: string;
  pause_batch?: boolean;
};

export type ReportItemHospitalResponse = {
  success?: boolean;
  hospital_id?: string;
  batch_id?: string;
  message?: string;
  next_action?: string;
};

export async function reportItemHospitalDuringPicking(
  body: ReportItemHospitalDuringPickingRequest
): Promise<ReportItemHospitalResponse> {
  const res = await api.post<ReportItemHospitalResponse>('/api/hospital/picking/report-issue', body);
  return (res.data as ReportItemHospitalResponse) ?? {};
}

export type MarkLocationHospitalRequest = {
  reason: string;
  description?: string;
};

export type LocationHospitalResponse = {
  id?: string;
  location_id?: string;
  reason?: string;
  is_active?: boolean;
};

export async function markLocationHospital(
  locationId: string,
  data: MarkLocationHospitalRequest
): Promise<LocationHospitalResponse> {
  const res = await api.post<LocationHospitalResponse>(`/api/locations/${encodeURIComponent(locationId)}/hospital`, data);
  return (res.data as LocationHospitalResponse) ?? {};
}
