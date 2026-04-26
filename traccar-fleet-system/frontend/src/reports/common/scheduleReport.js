import fetchOrThrow from "../../common/util/fetchOrThrow";
import { traccarPath } from '../../config/traccarApi.js';


export default async (deviceIds, groupIds, report) => {
  const response = await fetchOrThrow(traccarPath('/api/reports'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(report),
  });
  report = await response.json();
  if (deviceIds.length) {
    await fetchOrThrow(traccarPath('/api/permissions/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(deviceIds.map((id) => ({ deviceId: id, reportId: report.id }))),
    });
  }
  if (groupIds.length) {
    await fetchOrThrow(traccarPath('/api/permissions/bulk'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(groupIds.map((id) => ({ groupId: id, reportId: report.id }))),
    });
  }
  return null;
};
