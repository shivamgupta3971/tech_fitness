import { describe, it, expect } from "vitest";
import { extractVideoId, buildEmbedUrl } from "../lib/youtube";

describe("extractVideoId", () => {
  it("extracts YouTube standard watch URLs", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("http://m.youtube.com/watch?feature=shared&v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts YouTube short youtu.be links", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ?t=10")).toBe("dQw4w9WgXcQ");
  });

  it("extracts YouTube Shorts", () => {
    expect(extractVideoId("https://www.youtube.com/shorts/3xyz1234abc")).toBe("3xyz1234abc");
    expect(extractVideoId("https://youtube.com/shorts/3xyz1234abc?feature=share")).toBe("3xyz1234abc");
  });

  it("extracts YouTube Embeds", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts Instagram Reels and Posts", () => {
    expect(extractVideoId("https://www.instagram.com/reel/C_abc123XYZ/")).toBe("ig_C_abc123XYZ");
    expect(extractVideoId("https://www.instagram.com/reel/C_abc123XYZ/?igsh=MWx...#")).toBe("ig_C_abc123XYZ");
    expect(extractVideoId("https://instagram.com/p/C_abc123XYZ/")).toBe("ig_C_abc123XYZ");
    expect(extractVideoId("https://www.instagram.com/share/reel/C_abc123XYZ/")).toBe("ig_C_abc123XYZ");
  });

  it("extracts Facebook Reels and Watch links", () => {
    expect(extractVideoId("https://fb.watch/abcd1234/")).toBe("fb_abcd1234");
    expect(extractVideoId("https://www.facebook.com/reel/1234567890/")).toBe("fb_1234567890");
    expect(extractVideoId("https://m.facebook.com/reel/1234567890")).toBe("fb_1234567890");
    expect(extractVideoId("https://www.facebook.com/watch/?v=9876543210")).toBe("fb_9876543210");
    expect(extractVideoId("https://www.facebook.com/share/r/1234567890/")).toBe("fb_1234567890");
  });

  it("extracts TikTok links", () => {
    expect(extractVideoId("https://www.tiktok.com/@fitnessguy/video/7123456789012345678")).toBe("tt_7123456789012345678");
    expect(extractVideoId("https://vm.tiktok.com/ZM8abc123/")).toBe("tt_ZM8abc123");
    expect(extractVideoId("https://vt.tiktok.com/ZM8abc123/")).toBe("tt_ZM8abc123");
    expect(extractVideoId("https://www.tiktok.com/t/ZT8abc123/")).toBe("tt_ZT8abc123");
  });

  it("extracts Vimeo links", () => {
    expect(extractVideoId("https://vimeo.com/76979871")).toBe("vm_76979871");
  });

  it("handles WhatsApp media and direct video URLs via deterministic hash", () => {
    const waUrl = "https://media.whatsapp.net/v/t62.7118-24/12345_6789.mp4";
    const waId = extractVideoId(waUrl);
    expect(waId).toMatch(/^vid_[a-z0-9]+$/);

    const mp4Url = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    const mp4Id = extractVideoId(mp4Url);
    expect(mp4Id).toMatch(/^vid_[a-z0-9]+$/);

    // Consistency: same URL yields same ID
    expect(extractVideoId(mp4Url)).toBe(mp4Id);
  });

  it("handles URLs without protocol prefix", () => {
    expect(extractVideoId("youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractVideoId("instagram.com/reel/C_abc123XYZ/")).toBe("ig_C_abc123XYZ");
  });

  it("returns null on invalid inputs", () => {
    expect(extractVideoId("")).toBeNull();
    expect(extractVideoId("   ")).toBeNull();
    expect(extractVideoId(null as unknown as string)).toBeNull();
    expect(extractVideoId("not-a-valid-url")).toBeNull();
  });
});

describe("buildEmbedUrl", () => {
  it("builds correct embed URL", () => {
    expect(buildEmbedUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
  });
});
