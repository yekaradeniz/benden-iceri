import { GoogleGenAI } from '@google/genai';

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

const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Validates whether an image is appropriate for the Sufi poetry account.
 * Uses Google Gemini Flash (free tier) for vision moderation.
 *
 * @param {string} imageUrl - public URL of the image to validate
 * @param {string} apiKey - Google AI Studio API key (free)
 * @returns {Promise<{approved: boolean, reason?: string}>}
 */
export async function isPhotoSpiritual(imageUrl, apiKey) {
  if (!apiKey) {
    return { approved: true, reason: 'no api key - moderation skipped' };
  }

  // Fetch image to base64 (Gemini accepts inline base64 or remote URL - we use inline for reliability)
  const response = await fetch(imageUrl);
  if (!response.ok) {
    return { approved: false, reason: `image fetch failed: ${response.status}` };
  }
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const rawType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
  const mimeType = SUPPORTED_IMAGE_TYPES.includes(rawType) ? rawType : 'image/jpeg';

  const ai = new GoogleGenAI({ apiKey });
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: base64 } },
          { text: 'Is this image appropriate as the background for a Sufi poetry post?' }
        ]
      }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 10,
        temperature: 0
      }
    });

    const answer = (result.text || '').trim().toUpperCase();
    const approved = answer.startsWith('YES');
    return { approved, reason: answer };
  } catch (err) {
    // Rate limit or quota exceeded - skip moderation and approve
    if (err.status === 429 || (err.message && err.message.includes('quota'))) {
      console.warn('Gemini quota exceeded, skipping moderation for this photo.');
      return { approved: true, reason: 'quota-exceeded-skipped' };
    }
    throw err;
  }
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
