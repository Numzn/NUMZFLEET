#!/usr/bin/env python3
"""Extract Zambian place polygons and town points from a Geofabrik OSM extract.

    python3 -m venv .venv && .venv/bin/pip install osmium shapely
    .venv/bin/python extract_osm_places.py zambia-latest.osm.pbf osm-places.geojson

Writes ONE GeoJSON FeatureCollection with only what actually exists in the data:
  * area features for  boundary=administrative + admin_level 6/7/8, or place=city/town/suburb areas
  * Point features for place=city/town nodes (a town with no outline is kept as a location only)
Nothing is invented: no buffering, no convex hulls, no point-to-polygon substitution. Invalid
polygons are repaired with shapely make_valid ONLY when the result is still an area; the feature
says so (`validity`: valid | repaired), and unrepairable ones are dropped and counted on stderr.

Licence: OpenStreetMap data is (c) OpenStreetMap contributors, ODbL 1.0 -- the output is a
Derivative Database and must keep that attribution (the catalogue builder records it per row).
"""
import json
import sys
from collections import Counter

import osmium
import shapely.wkb as wkblib
from shapely.geometry import mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

ADMIN_LEVELS = {'6', '7', '8'}
PLACE_AREAS = {'city', 'town', 'suburb'}
PLACE_POINTS = {'city', 'town'}


def keep_tags(tags):
    t = {k: v for k, v in tags}
    return {
        'name': t.get('name'),
        'name_en': t.get('name:en'),
        'alt_name': t.get('alt_name'),
        'old_name': t.get('old_name'),
        'admin_level': t.get('admin_level'),
        'boundary': t.get('boundary'),
        'place': t.get('place'),
        'population': t.get('population'),
    }


def main(src, dst):
    wkb = osmium.geom.WKBFactory()
    features, stats = [], Counter()
    for obj in osmium.FileProcessor(src).with_areas().with_filter(
        osmium.filter.KeyFilter('place', 'boundary')
    ):
        tags = {k: v for k, v in obj.tags}
        if not tags.get('name'):
            continue
        if obj.is_node():
            if tags.get('place') not in PLACE_POINTS:
                continue
            props = keep_tags(obj.tags)
            props.update({'osm_type': 'node', 'osm_id': obj.id})
            features.append({'type': 'Feature', 'properties': props,
                             'geometry': {'type': 'Point', 'coordinates': [obj.lon, obj.lat]}})
            stats['point'] += 1
        elif obj.is_area():
            admin = tags.get('boundary') == 'administrative' and tags.get('admin_level') in ADMIN_LEVELS
            place = tags.get('place') in PLACE_AREAS
            if not (admin or place):
                continue
            geom = wkblib.loads(wkb.create_multipolygon(obj), hex=True)
            validity = 'valid'
            if not geom.is_valid:
                fixed = make_valid(geom)
                polys = [g for g in getattr(fixed, 'geoms', [fixed]) if g.geom_type in ('Polygon', 'MultiPolygon')]
                if not polys:
                    stats['dropped_unrepairable'] += 1
                    continue
                geom = unary_union(polys)
                validity = 'repaired'
            if geom.is_empty or geom.geom_type not in ('Polygon', 'MultiPolygon'):
                stats['dropped_empty'] += 1
                continue
            props = keep_tags(obj.tags)
            # area ids: relation r -> 2*id+1 ; way -> 2*id  (osmium convention)
            props.update({'osm_type': 'relation' if obj.from_way() is False else 'way',
                          'osm_id': obj.orig_id(), 'validity': validity})
            features.append({'type': 'Feature', 'properties': props, 'geometry': mapping(geom)})
            stats[f"area_{'admin' + tags.get('admin_level', '') if admin else tags.get('place')}"] += 1
    with open(dst, 'w') as fh:
        json.dump({'type': 'FeatureCollection', 'features': features}, fh)
    print(dict(stats), file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
