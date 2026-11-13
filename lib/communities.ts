// Communities that can run the holiday decor contest. Browser-safe: pages pass the slug, components look it up here.
// Liberty (the default, at /holiday) uses its hand-tuned map modules; others are built with lib/mapKit.
import { makeAffineGeo, makeLots, makeStreetAt, type MapDef } from './mapKit';
import { SKYLINE_AFFINE, SKYLINE_BOUNDS, SKYLINE_IMAGE, SKYLINE_LOT_ADDR, SKYLINE_LOTS, SKYLINE_SEGMENTS, SKYLINE_STREETS } from './skylineMap';
import { geoToMap, MAP_IMAGE, STREETS } from './treatsGeo';
import { lotAt, lotBoxes } from './treatsLots';
import { streetAt } from './treatsStreets';

export type GeoBounds = { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } };

export type Community = {
  slug: string;
  /** Shown in headings, e.g. "Liberty community". */
  name: string;
  /** Short name for sentences ("lighting up Liberty"). */
  short: string;
  /** Public contest page. */
  path: string;
  map: MapDef;
  /** Area for Google address suggestions and reverse lookups. */
  bounds: GeoBounds;
  /** Contest days (MM-DD, Arizona time) that differ from the defaults: enter until 12-10, vote 12-11 to 12-22, winners 12-23. */
  dates?: Partial<Record<'entryCloses' | 'voteOpens' | 'voteCloses' | 'results', string>>;
};

const liberty: Community = {
  slug: 'liberty',
  name: 'Liberty community',
  short: 'Liberty',
  path: '/holiday',
  map: {
    src: '/holiday-map-v2.jpg',
    width: MAP_IMAGE.width,
    height: MAP_IMAGE.height,
    streets: STREETS,
    lotAt,
    lotBoxes,
    streetAt,
    geoToMap,
    lotLong: 55,
  },
  // Roeser Rd to Southern Ave and 27th Ave to 23rd Ave, with a small margin.
  bounds: { low: { latitude: 33.3917, longitude: -112.1168 }, high: { latitude: 33.4, longitude: -112.1073 } },
};

const skyLots = makeLots(SKYLINE_LOTS, SKYLINE_IMAGE.width, SKYLINE_IMAGE.height);
const skyline: Community = {
  slug: 'skyline-ranch-ii',
  name: 'Skyline Ranch II · San Tan Valley',
  short: 'Skyline Ranch II',
  path: '/holiday/skyline-ranch-ii',
  map: {
    src: SKYLINE_IMAGE.src,
    width: SKYLINE_IMAGE.width,
    height: SKYLINE_IMAGE.height,
    streets: SKYLINE_STREETS,
    lotAt: skyLots.lotAt,
    lotBoxes: skyLots.lotBoxes,
    streetAt: makeStreetAt(SKYLINE_SEGMENTS, SKYLINE_IMAGE.width, SKYLINE_IMAGE.height),
    geoToMap: makeAffineGeo(SKYLINE_AFFINE, SKYLINE_IMAGE.width, SKYLINE_IMAGE.height),
    lotLong: skyLots.lotLong,
    addressAt: (x, y) => {
      const a = SKYLINE_LOT_ADDR[skyLots.lotIndexAt(x, y)];
      return a ? { number: String(a[0]), street: SKYLINE_STREETS[a[1]] } : null;
    },
  },
  bounds: SKYLINE_BOUNDS,
  // Their social committee: voting ends Dec 15, winners the next day.
  dates: { voteCloses: '12-15', results: '12-16' },
};

export const COMMUNITIES: Record<string, Community> = { [liberty.slug]: liberty, [skyline.slug]: skyline };
export const DEFAULT_COMMUNITY = liberty.slug;

export function getCommunity(slug: string | null | undefined): Community | null {
  return (slug && COMMUNITIES[slug]) || null;
}
/** Unknown or missing → Liberty, so older links and requests keep working. */
export const communityOrDefault = (slug: unknown): Community => getCommunity(typeof slug === 'string' ? slug : null) || liberty;
