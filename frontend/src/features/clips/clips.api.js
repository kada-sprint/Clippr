import { apiRequest } from '../../lib/api.js';

export async function fetchClips(projectId, { signal } = {}) {
  const data = await apiRequest(`/projects/${projectId}/clips`, { signal });
  return data.clips;
}

export async function fetchTranscript(clipId, { signal } = {}) {
  const data = await apiRequest(`/clips/${clipId}/transcript`, { signal });
  return data;
}

export async function updateClip(clipId, patch, { signal } = {}) {
  const data = await apiRequest(`/clips/${clipId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    signal,
  });
  return data.clip;
}

export async function renderClip(clipId, { signal } = {}) {
  const data = await apiRequest(`/clips/${clipId}/render`, {
    method: 'POST',
    body: JSON.stringify({}),
    signal,
  });
  return data.clip;
}
