# MOSAIC – Project TODOs

## Childcare Seed Data

- [ ] Audit childcare data to exclude home providers (individual licensed family daycare operators) and school-age-only programs (vacation stations, summer-only programs) — keep licensed childcare centers only
- [ ] Geocode all childcare entries that currently have `lat: null, lng: null`
- [ ] Regenerate / verify batch 1 childcare entries (~200 facilities) for St. Louis County ZIPs: 63005, 63011, 63017, 63021, 63025, 63026, 63038, 63040, 63044, 63105, 63117, 63119, 63121, 63122, 63123, 63124, 63125, 63126, 63127, 63128, 63131, 63141, 63144, 63146
- [ ] Regenerate / verify St. Charles County ZIPs: 63301, 63303, 63304, 63366, 63368

## Build / Pipeline

- [ ] Build pipeline errors on sites with null coordinates — fixed in distanceChecks.ts, but downstream public dataset output should also handle nulls gracefully
