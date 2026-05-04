const API_BASE = 'https://graph.facebook.com/v21.0';

async function apiPost(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u.toString(), { method: 'POST' });
  const json = await res.json();
  if (!res.ok) {
    console.error('Instagram API error:', JSON.stringify(json));
    throw new Error(json.error?.message || res.statusText);
  }
  return json;
}

async function apiGet(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u.toString());
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || res.statusText);
  return json;
}

async function waitUntilReady(mediaId, accessToken, maxWaitMs = 120000) {
  const interval = 5000;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const data = await apiGet(`${API_BASE}/${mediaId}`, {
      fields: 'status_code',
      access_token: accessToken
    });
    const code = data.status_code;
    console.log(`  Media ${mediaId} status_code: ${code}`);
    if (code === 'FINISHED') return;
    if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Media ${mediaId} status: ${code}`);
    await new Promise(r => setTimeout(r, interval));
  }
  throw new Error(`Media ${mediaId} not ready after ${maxWaitMs}ms`);
}

export async function postToInstagram({ igUserId, accessToken, imageUrl, caption }) {
  const { id: containerId } = await apiPost(`${API_BASE}/${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken
  });
  const { id: postId } = await apiPost(`${API_BASE}/${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken
  });
  return { postId, containerId };
}

export async function postCarouselToInstagram({ igUserId, accessToken, imageUrls, caption }) {
  // Step 1: create a child media item for each image
  const childIds = [];
  for (const imageUrl of imageUrls) {
    const { id } = await apiPost(`${API_BASE}/${igUserId}/media`, {
      image_url: imageUrl,
      is_carousel_item: 'true',
      access_token: accessToken
    });
    childIds.push(id);
  }

  // Step 1b: wait for all child items to finish processing
  for (const childId of childIds) {
    await waitUntilReady(childId, accessToken);
  }

  // Step 2: create carousel container
  const { id: containerId } = await apiPost(`${API_BASE}/${igUserId}/media`, {
    media_type: 'CAROUSEL',
    children: childIds.join(','),
    caption,
    access_token: accessToken
  });

  // Step 3: publish
  const { id: postId } = await apiPost(`${API_BASE}/${igUserId}/media_publish`, {
    creation_id: containerId,
    access_token: accessToken
  });

  return { postId, containerId };
}
