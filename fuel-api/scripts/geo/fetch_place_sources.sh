#!/usr/bin/env bash
# Download the raw geographic sources the place catalogue is built from.
#
#   scripts/geo/fetch_place_sources.sh [DEST_DIR]      (default: ./place-sources, git-ignored; never commit it)
#
# Run ONCE per refresh, by hand -- the app never downloads anything at request time.
#   * geoBoundaries gbOpen ZMB ADM1 (provinces) + ADM2 (districts), CC BY 4.0 -- the download URL is read
#     from geoBoundaries' own API response, so the metadata and the geometry always agree.
#   * Geofabrik Zambia OSM extract (~250 MB), ODbL -- verified against Geofabrik's published MD5.
# Checksums of everything fetched are written to SHA256SUMS and copied into the built catalogue.
set -euo pipefail
DEST="${1:-./place-sources}"
mkdir -p "$DEST"
cd "$DEST"
UA="NUMZFLEET-place-catalogue/1.0 (numz.site)"

for LEVEL in ADM1 ADM2; do
  curl -fsSL -A "$UA" "https://www.geoboundaries.org/api/current/gbOpen/ZMB/$LEVEL/" -o "gb-$LEVEL.meta.json"
  URL="$(python3 -c "import json,sys;print(json.load(open('gb-$LEVEL.meta.json'))['gjDownloadURL'])")"
  echo "geoBoundaries $LEVEL <- $URL"
  curl -fsSL -A "$UA" "$URL" -o "gb-$LEVEL.geojson"
done

PBF_URL="https://download.geofabrik.de/africa/zambia-latest.osm.pbf"
REAL="$(curl -fsSIL -A "$UA" -o /dev/null -w '%{url_effective}' "$PBF_URL")"
echo "Geofabrik <- $REAL"
curl -fsSL -A "$UA" -C - "$REAL" -o zambia-latest.osm.pbf
curl -fsSL -A "$UA" "$REAL.md5" -o zambia-latest.osm.pbf.md5
EXPECTED="$(cut -d' ' -f1 zambia-latest.osm.pbf.md5)"
ACTUAL="$(md5sum zambia-latest.osm.pbf | cut -d' ' -f1)"
[ "$EXPECTED" = "$ACTUAL" ] || { echo "MD5 mismatch for the OSM extract" >&2; exit 1; }
printf '{"version":"%s","sourceUrl":"%s"}\n' "$(basename "$REAL")" "$REAL" > osm.meta.json
sha256sum gb-ADM1.geojson gb-ADM2.geojson zambia-latest.osm.pbf > SHA256SUMS
echo "OK. Next: extract_osm_places.py zambia-latest.osm.pbf osm-places.geojson, then buildPlaceCatalogue.js"
