const API_BASE = 'https://graph.facebook.com/v21.0';

async function apiPost(url, params) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u.toString(), { method: 'POST' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || res.statusText);
  return json;
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
