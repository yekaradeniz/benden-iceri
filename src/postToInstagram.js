const API_BASE = 'https://graph.facebook.com/v21.0';

export async function postToInstagram({ igUserId, accessToken, imageUrl, caption }) {
  // Step 1: create media container
  const containerUrl = new URL(`${API_BASE}/${igUserId}/media`);
  containerUrl.searchParams.set('image_url', imageUrl);
  containerUrl.searchParams.set('caption', caption);
  containerUrl.searchParams.set('access_token', accessToken);

  const containerRes = await fetch(containerUrl.toString(), { method: 'POST' });
  if (!containerRes.ok) {
    const err = await containerRes.json().catch(() => ({}));
    throw new Error(`Container creation failed: ${err.error?.message || containerRes.statusText}`);
  }
  const { id: containerId } = await containerRes.json();

  // Step 2: publish
  const publishUrl = new URL(`${API_BASE}/${igUserId}/media_publish`);
  publishUrl.searchParams.set('creation_id', containerId);
  publishUrl.searchParams.set('access_token', accessToken);

  const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    throw new Error(`Publish failed: ${err.error?.message || publishRes.statusText}`);
  }
  const { id: postId } = await publishRes.json();

  return { postId, containerId };
}
