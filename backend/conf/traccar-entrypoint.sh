#!/bin/sh
# Renders conf/traccar.xml.template into a real config file with the telemetry
# shared secret substituted in, then starts Traccar. Exists because the
# traccar/traccar Docker image does not translate TRACCAR_*-prefixed env vars
# into config overrides (its entrypoint is a bare `java -jar`), so the secret
# can't be injected the way docker-compose.prod.yml's TRACCAR_EVENT_FORWARD_HEADER
# comment used to assume. See backend/conf/traccar.xml.template for the
# background, and docs/architecture/vehicle-state-engine.md for how this was
# diagnosed.
set -eu

: "${TELEMETRY_INGEST_SECRET:?TELEMETRY_INGEST_SECRET must be set for Traccar to authenticate its telemetry webhook to fuel-api}"

HEADER_VALUE="x-telemetry-secret: ${TELEMETRY_INGEST_SECRET}"

sed "s|__EVENT_FORWARD_HEADER__|${HEADER_VALUE}|" \
  /opt/traccar/conf/traccar.xml.template > /opt/traccar/conf/traccar.xml.generated

exec /opt/traccar/jre/bin/java -jar tracker-server.jar conf/traccar.xml.generated
