import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are a strict content moderator for @iceribenden, a Sufi/Islamic mystical poetry Instagram account that posts daily verses from Niyazî-i Mısrî, Salih Baba Dîvânı, and Naqshbandi spiritual masters.

Your job: decide if an image is appropriate as the background for a Sufi/aşk yolculuğu (love journey) poetry post.

APPROPRIATE (YES):
- Mosques, mihrab, Islamic calligraphy, Quran/Mushaf, manuscripts
- Prayer beads (tesbih), candles in spiritual context, oil lamps
- Mecca, Medina, holy sites, Islamic architecture
- Dervish silhouettes, traditional Sufi clothing
- Atmospheric nature: deserts, mountains, mist, light beams, water reflections
- Single roses (Sufi symbol of divine love), tulips (Ottoman/Sufi symbol)
- Old books, ink, calligraphy pens (divan culture)
- Abstract spiritual/contemplative imagery, soft light scenes

INAPPROPRIATE (NO):
- People in modern Western attire (women in tank tops, men in jeans, sportswear)
- Commercial brands, logos, store signs, neon advertising
- Neon lights, club, party imagery, nightlife
- Christian/Buddhist/Hindu/other non-Islamic religious imagery (crosses, Buddha statues, etc.)
- Christmas, secular holidays
- Modern tech: laptops, smartphones, cars, planes prominently featured
- Sports: gym, climbing walls, swimming pools, soccer, etc.
- Beach parties, weddings, food shots, restaurants
- Cute animals, pets, zoos
- Underwater, scuba diving
- Celebrities, famous faces, identifiable modern people
- Vans/road trips/tourism shots/hippie aesthetic
- Children playing, family portraits

When in doubt, REJECT to keep the authentic Sufi voice.

Respond with EXACTLY one word: YES or NO. No explanation, no punctuation, just the word.`;

/**
 * Validates whether an image is appropriate for the Sufi poetry account.
 * Returns true if appropriate, false otherwise.
 *
 * @param {string} imageUrl - public URL of the image to validate
 * @param {string} apiKey - Anthropic API key
 * @returns {Promise<{approved: boolean, reason?: string}>}
 */
export async function isPhotoSpiritual(imageUrl, apiKey) {
  if (!apiKey) {
    return { approved: true, reason: 'no api key — moderation skipped' };
  }

  const client = new Anthropic({ apiKey });

  // Fetch image and convert to base64 (Claude vision needs base64 input)
  const response = await fetch(imageUrl);
  if (!response.ok) {
    return { approved: false, reason: `image fetch failed: ${response.status}` };
  }
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  // Normalize content type to one of Claude-supported types
  const mediaType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    .includes(contentType.split(';')[0].trim())
    ? contentType.split(';')[0].trim()
    : 'image/jpeg';

  const result = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 10,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 }
        },
        {
          type: 'text',
          text: 'Is this image appropriate as the background for a Sufi poetry post?'
        }
      ]
    }]
  });

  const answer = (result.content[0]?.text || '').trim().toUpperCase();
  const approved = answer.startsWith('YES');
  return { approved, reason: answer };
}

/**
 * Picks a photo whose moods match verseMoods AND passes AI moderation.
 * Tries up to maxAttempts photos. Throws if all fail.
 */
export async function pickValidatedPhoto({
  photos,
  verseMoods,
  recentlyUsed,
  apiKey,
  maxAttempts = 5,
  rng = Math.random
}) {
  const matching = photos.filter(p =>
    p.moods.some(m => verseMoods.includes(m))
  );
  if (matching.length === 0) {
    throw new Error(`no photo matches verse moods: ${verseMoods.join(', ')}`);
  }

  // Order: fresh (not recent) first, then recent. Within each group: shuffle.
  const fresh = matching.filter(p => !recentlyUsed.has(p.id));
  const recent = matching.filter(p => recentlyUsed.has(p.id));
  const shuffled = (arr) => arr
    .map(v => [rng(), v])
    .sort((a, b) => a[0] - b[0])
    .map(x => x[1]);
  const ordered = [...shuffled(fresh), ...shuffled(recent)];

  const tried = [];
  for (const photo of ordered.slice(0, maxAttempts)) {
    const { approved, reason } = await isPhotoSpiritual(photo.url, apiKey);
    if (approved) {
      console.log(`✓ Photo ${photo.id} passed moderation`);
      return photo;
    }
    console.log(`✗ Photo ${photo.id} rejected: ${reason}`);
    tried.push(photo.id);
  }

  throw new Error(
    `No photo passed AI moderation after ${tried.length} attempts. Tried: ${tried.join(', ')}`
  );
}
