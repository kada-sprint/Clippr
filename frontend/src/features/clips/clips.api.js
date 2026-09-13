import { apiRequest } from '../../lib/api.js';

export async function fetchClips(projectId, { signal } = {}) {
  const data = await apiRequest(`/projects/${projectId}/clips`, { signal });
  return data.clips;
}
