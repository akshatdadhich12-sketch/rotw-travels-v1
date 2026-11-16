# Reviews Data Schema

Real reviews are stored in reviews.json matching this schema:
- id (string): Unique review identifier (e.g. "rev-001").
- quote (string): Verbatim review text directly from a real client.
- firstName (string): Client first name or initial (e.g. "David M.").
- trip (string): Exact journey title or destination visited.
- date (string): Month and year of travel in ISO format (YYYY-MM).
- sourceName (string): Platform name (e.g. "Google Reviews", "TripAdvisor").
- sourceUrl (string|null): Verifiable public source URL, or null if private email.
- language (string): ISO language code ("en", "ru", "ar", "hi").
- permissionFlag (boolean): Strict flag; true only if verified consent exists.

Only real reviews with permissionFlag: true and verified source URL may be added.
Never invent reviews, star ratings, quotes, or fake names under any circumstances.