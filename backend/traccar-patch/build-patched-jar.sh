#!/usr/bin/env bash
# Builds a patched tracker-server.jar: the upstream Traccar jar with only
# org/traccar/session/ConnectionManager*.class replaced by the version in
# ConnectionManager.patch (see README.md for what and why).
#
# Needs: docker, curl, python3, patch, sha256sum, sha1sum. No JDK: the class is
# compiled with the Eclipse compiler (ECJ) running on the base image's own JRE.
#
#   ./build-patched-jar.sh                       # builds against the production pin
#   BASE_IMAGE=... ./build-patched-jar.sh        # override the base image
#
# Output: ./out/tracker-server.jar  (use with the Dockerfile in this directory)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${OUT:-$HERE/out}"

# --- pinned inputs -----------------------------------------------------------
UPSTREAM_TAG="v6.15.3"
UPSTREAM_PATH="src/main/java/org/traccar/session/ConnectionManager.java"
UPSTREAM_SHA256="524ea421b89b7aae9186b9e10fd29ad2070fdd06d71a7e5608c61c0a8af1b666"
# Same digest as deployment/compose/docker-compose.prod.yml.
BASE_IMAGE="${BASE_IMAGE:-traccar/traccar:6.15.3@sha256:35346b4af46d57adaeff69a548a7d2cb189a2487fe9c24c99044ee7aa104b5df}"
ECJ_VERSION="3.46.0"
ECJ_SHA1="e962128cf16c864b61633b5a1c75709b0ba2f017"
# -----------------------------------------------------------------------------

log() { printf '[traccar-patch] %s\n' "$*"; }
die() { printf '[traccar-patch] ERROR: %s\n' "$*" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$OUT" "$WORK/src" "$WORK/classes"

log "fetching upstream ${UPSTREAM_TAG} ConnectionManager.java"
curl -fsS --retry 3 --max-time 300 -o "$WORK/src/ConnectionManager.java" \
  "https://raw.githubusercontent.com/traccar/traccar/${UPSTREAM_TAG}/${UPSTREAM_PATH}"
actual="$(sha256sum "$WORK/src/ConnectionManager.java" | cut -d' ' -f1)"
[[ "$actual" == "$UPSTREAM_SHA256" ]] || die "upstream source changed (sha256 $actual); refusing to patch an unreviewed file"

log "applying ConnectionManager.patch"
mkdir -p "$WORK/tree/src/main/java/org/traccar/session"
cp "$WORK/src/ConnectionManager.java" "$WORK/tree/${UPSTREAM_PATH}"
patch --quiet -p1 -d "$WORK/tree" < "$HERE/ConnectionManager.patch"

log "fetching ECJ ${ECJ_VERSION}"
curl -fsS --retry 3 --max-time 600 -o "$WORK/ecj.jar" \
  "https://repo1.maven.org/maven2/org/eclipse/jdt/ecj/${ECJ_VERSION}/ecj-${ECJ_VERSION}.jar"
[[ "$(sha1sum "$WORK/ecj.jar" | cut -d' ' -f1)" == "$ECJ_SHA1" ]] || die "ECJ checksum mismatch"

log "extracting the base jar from ${BASE_IMAGE}"
cid="$(docker create "$BASE_IMAGE")"
trap 'docker rm -f "$cid" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT
docker cp "$cid:/opt/traccar/tracker-server.jar" "$WORK/base.jar"

version="$(python3 -I - "$WORK/base.jar" <<'PY'
import sys, zipfile
manifest = zipfile.ZipFile(sys.argv[1]).read('META-INF/MANIFEST.MF').decode().replace('\r', '')
print(next((l.split(': ', 1)[1] for l in manifest.split('\n') if l.startswith('Implementation-Version: ')), ''))
PY
)"
log "base jar is Traccar ${version}"
if [[ "v${version}" != "$UPSTREAM_TAG" && "${ALLOW_VERSION_MISMATCH:-0}" != "1" ]]; then
  die "base image is ${version} but the patch is for ${UPSTREAM_TAG} (ALLOW_VERSION_MISMATCH=1 to test anyway)"
fi

log "compiling with ECJ on the image's JRE"
docker run --rm --user "$(id -u):$(id -g)" --entrypoint sh -v "$WORK:/work" "$BASE_IMAGE" -c '
  CP=$(ls /opt/traccar/lib/*.jar | tr "\n" ":")
  /opt/traccar/jre/bin/java -jar /work/ecj.jar -17 -nowarn -proc:none \
    -cp "/opt/traccar/tracker-server.jar:$CP" \
    -d /work/classes /work/tree/'"$UPSTREAM_PATH"'
'
find "$WORK/classes" -name 'ConnectionManager*.class' | grep -q . || die "compilation produced no classes"

log "overlaying classes onto the jar"
python3 -I - "$WORK/base.jar" "$WORK/classes" "$OUT/tracker-server.jar" <<'PY'
import sys, zipfile, pathlib
base, classes, out = sys.argv[1], pathlib.Path(sys.argv[2]), sys.argv[3]
repl = {p.relative_to(classes).as_posix(): p.read_bytes() for p in classes.rglob('*.class')}
src = zipfile.ZipFile(base)
dst = zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED)
seen = set()
for item in src.infolist():
    data = repl.get(item.filename)
    dst.writestr(item.filename, data if data is not None else src.read(item.filename))
    if data is not None:
        seen.add(item.filename)
for name, data in repl.items():
    if name not in seen:
        dst.writestr(name, data)
dst.close()
print('[traccar-patch] replaced:', ', '.join(sorted(seen)))
PY

log "done: $OUT/tracker-server.jar"
