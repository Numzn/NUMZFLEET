#!/bin/sh
# Renders conf/traccar.xml.template into a real config file with secrets
# substituted in (telemetry shared secret, native SMTP mailer credentials),
# then starts Traccar. Exists because the traccar/traccar Docker image does
# not translate TRACCAR_*-prefixed env vars into config overrides (its
# entrypoint is a bare `java -jar`), so secrets can't be injected the way
# docker-compose.prod.yml's TRACCAR_EVENT_FORWARD_HEADER comment used to
# assume. See backend/conf/traccar.xml.template for the background, and
# docs/architecture/vehicle-state-engine.md for how this was diagnosed.
set -eu

: "${TELEMETRY_INGEST_SECRET:?TELEMETRY_INGEST_SECRET must be set for Traccar to authenticate its telemetry webhook to fuel-api}"
: "${TRACCAR_MAIL_SMTP_USERNAME:?TRACCAR_MAIL_SMTP_USERNAME must be set for Traccar's native SMTP mailer (separate from fuel-api's own EMAIL_* vars)}"
: "${TRACCAR_MAIL_SMTP_PASSWORD:?TRACCAR_MAIL_SMTP_PASSWORD must be set for Traccar's native SMTP mailer (separate from fuel-api's own EMAIL_* vars)}"

HEADER_VALUE="x-telemetry-secret: ${TELEMETRY_INGEST_SECRET}"

sed \
  -e "s|__EVENT_FORWARD_HEADER__|${HEADER_VALUE}|" \
  -e "s|__MAIL_SMTP_USERNAME__|${TRACCAR_MAIL_SMTP_USERNAME}|" \
  -e "s|__MAIL_SMTP_PASSWORD__|${TRACCAR_MAIL_SMTP_PASSWORD}|" \
  /opt/traccar/conf/traccar.xml.template > /opt/traccar/conf/traccar.xml.generated

# -Djava.net.preferIPv4Stack=true: this Docker network has no real IPv6
# egress, but DNS still returns AAAA records for smtp.gmail.com (and likely
# other external hosts) — without this, the JVM's resolver picks the
# unreachable IPv6 address and jakarta.mail fails with UnknownHostException
# even though the host resolves and the IPv4 address is directly reachable.
# Confirmed via direct testing 2026-09-01, not assumed.
exec /opt/traccar/jre/bin/java -Djava.net.preferIPv4Stack=true -jar tracker-server.jar conf/traccar.xml.generated
