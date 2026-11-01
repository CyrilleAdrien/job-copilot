import { describe, expect, it } from "vitest";

import { centerSquare, initials, prepareAvatar } from "@/lib/avatar";

describe("photo de profil", () => {
  it("crops the largest centered square", () => {
    expect(centerSquare(800, 600)).toEqual({ x: 100, y: 0, side: 600 });
    expect(centerSquare(600, 800)).toEqual({ x: 0, y: 100, side: 600 });
    expect(centerSquare(500, 500)).toEqual({ x: 0, y: 0, side: 500 });
  });

  it("falls back on the initials of the name", () => {
    expect(initials("Cyrille Adrien Fotso")).toBe("CF");
    expect(initials("  élodie ")).toBe("É");
    expect(initials("")).toBe("");
    expect(initials(null)).toBe("");
  });

  it("refuses a huge file before reading it", async () => {
    const huge = new File([new Uint8Array(25 * 1024 * 1024 + 1)], "photo.jpg", { type: "image/jpeg" });
    await expect(prepareAvatar(huge)).rejects.toMatchObject({ status: 413 });
  });
});
