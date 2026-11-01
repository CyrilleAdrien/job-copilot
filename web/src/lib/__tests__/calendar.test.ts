import { describe, expect, it } from "vitest";

import {
  countdown,
  dayKey,
  defaultTitle,
  eventsByDay,
  feedUrl,
  googleCalendarUrl,
  isoToLocal,
  localToIso,
  monthGrid,
  type CalendarEvent,
} from "@/lib/calendar";

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: "e1",
  application_id: null,
  kind: "interview",
  title: "Entretien · Nimbus",
  starts_at: "2026-11-04T13:00:00Z",
  ends_at: "2026-11-04T14:00:00Z",
  location: "Paris",
  video_url: "https://meet.example/abc",
  notes: "Préparer le cas",
  synced_at: null,
  sync_error: null,
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-01T10:00:00Z",
  ...overrides,
});

describe("calendrier", () => {
  it("prépare un lien Google Agenda prérempli", () => {
    const url = new URL(googleCalendarUrl(event()));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Entretien · Nimbus");
    expect(url.searchParams.get("dates")).toBe("20261104T130000Z/20261104T140000Z");
    expect(url.searchParams.get("details")).toBe("Préparer le cas\n\nVisio : https://meet.example/abc");
    expect(url.searchParams.get("location")).toBe("Paris");
  });

  it("affiche six semaines du lundi au dimanche", () => {
    const days = monthGrid(new Date(2026, 10, 1)); // novembre 2026 commence un dimanche
    expect(days).toHaveLength(42);
    expect(dayKey(days[0])).toBe("2026-10-26");
    expect(days[0].getDay()).toBe(1);
    expect(dayKey(days[6])).toBe("2026-11-01");
  });

  it("convertit la saisie locale en ISO et inversement", () => {
    const iso = localToIso("2026-11-04", "14:30");
    expect(isoToLocal(iso)).toEqual({ day: "2026-11-04", time: "14:30" });
  });

  it("regroupe les événements par jour, dans l'ordre", () => {
    const days = eventsByDay([
      event({ id: "b", starts_at: localToIso("2026-11-04", "15:00") }),
      event({ id: "a", starts_at: localToIso("2026-11-04", "09:00") }),
    ]);
    expect(days.get("2026-11-04")?.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("dit dans combien de temps a lieu un rendez-vous", () => {
    const now = new Date(2026, 10, 1, 9, 0);
    expect(countdown(new Date(2026, 10, 1, 15, 0).toISOString(), now)).toBe("aujourd'hui");
    expect(countdown(new Date(2026, 10, 2, 9, 0).toISOString(), now)).toBe("demain");
    expect(countdown(new Date(2026, 10, 6, 9, 0).toISOString(), now)).toBe("dans 5 j");
    expect(countdown(new Date(2026, 9, 30, 9, 0).toISOString(), now)).toBeNull();
  });

  it("propose un titre et une adresse d'abonnement", () => {
    expect(defaultTitle("interview", { title: "SRE", company: "Nimbus" })).toBe("Entretien · Nimbus");
    expect(defaultTitle("technical_test", { title: "SRE", company: null })).toBe("Test technique · SRE");
    expect(defaultTitle("other")).toBe("Rendez-vous");
    expect(feedUrl("http://localhost:3000")).toBe("webcal://localhost:3000/api/calendar/feed.ics");
  });
});
