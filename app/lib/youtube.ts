/**
 * Universal video ID and media link extractor.
 * Supports YouTube (Standard, Shorts, Embeds), Instagram Reels/Posts,
 * Facebook Reels/Watch, TikTok, Vimeo, WhatsApp shared media links,
 * and direct MP4/video URLs.
 */

function hashUrl(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Extracts a unique, filesystem-safe video identifier from any video URL.
 */
export function extractVideoId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let url = rawUrl.trim();
  if (!url) return null;

  // Add protocol if user typed without http(s)://
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  // 1. YouTube Short links (youtu.be/xxx)
  const youtuBeMatch = url.match(/(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (youtuBeMatch) return youtuBeMatch[1];

  // 2. YouTube Standard Watch (youtube.com/watch?v=xxx)
  const ytLongMatch = url.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i);
  if (ytLongMatch) return ytLongMatch[1];

  // 3. YouTube Shorts (youtube.com/shorts/xxx)
  const ytShortsMatch = url.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
  if (ytShortsMatch) return ytShortsMatch[1];

  // 4. YouTube Embeds (youtube.com/embed/xxx)
  const ytEmbedMatch = url.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
  if (ytEmbedMatch) return ytEmbedMatch[1];

  // 5. Instagram Reels / Posts / Shares (instagram.com/reel/xxx or /reels/xxx or /p/xxx or /share/reel/xxx)
  const igMatch = url.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?instagram\.com\/(?:reel|reels|p|share\/reel)\/([a-zA-Z0-9_-]+)/i);
  if (igMatch) return `ig_${igMatch[1]}`;

  // 6. Facebook Reels / Watch / Shares (fb.watch/xxx, facebook.com/reel/xxx, facebook.com/watch/?v=xxx, facebook.com/share/r/xxx)
  const fbWatchMatch = url.match(/(?:https?:\/\/)?(?:www\.)?fb\.watch\/([a-zA-Z0-9_-]+)/i);
  if (fbWatchMatch) return `fb_${fbWatchMatch[1]}`;

  const fbReelMatch = url.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?facebook\.com\/(?:reel\/|watch\/?\?(?:.*&)?v=|share\/[rv]\/)([a-zA-Z0-9_-]+)/i);
  if (fbReelMatch) return `fb_${fbReelMatch[1]}`;

  // 7. TikTok (tiktok.com/@user/video/xxx or vm.tiktok.com/xxx or vt.tiktok.com/xxx or tiktok.com/t/xxx)
  const ttMatch = url.match(/(?:https?:\/\/)?(?:(?:[a-zA-Z0-9-]+\.)?tiktok\.com\/(?:@[^/]+\/video\/|t\/)|(?:vm|vt)\.tiktok\.com\/)([a-zA-Z0-9_-]+)/i);
  if (ttMatch) return `tt_${ttMatch[1]}`;

  // 8. Vimeo (vimeo.com/xxx)
  const vimeoMatch = url.match(/(?:https?:\/\/)?(?:[a-zA-Z0-9-]+\.)?vimeo\.com\/([0-9]+)/i);
  if (vimeoMatch) return `vm_${vimeoMatch[1]}`;

  // 9. Generic URL, WhatsApp shared link, or direct MP4/video link
  try {
    const parsed = new URL(url);
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname.includes(".") || parsed.hostname === "localhost")
    ) {
      // Strip dynamic tracking query params so repeated links to same video share cache
      const cleanPath = `${parsed.hostname}${parsed.pathname}`.toLowerCase();
      const hash = hashUrl(cleanPath);
      return `vid_${hash}`;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Builds a YouTube embed URL from a video ID (if 11-char YouTube ID).
 */
export function buildEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
}
