# Production Traccar image with the GT06 session-race patch applied.
#
# Build the jar first (it is the stock jar with only ConnectionManager*.class
# replaced; see README.md):
#
#   ./build-patched-jar.sh
#   docker build -t numzfleet-traccar:6.15.3-gt06fix .
#
# The base is pinned by digest, identical to deployment/compose/docker-compose.prod.yml.
FROM traccar/traccar:6.15.3@sha256:35346b4af46d57adaeff69a548a7d2cb189a2487fe9c24c99044ee7aa104b5df
COPY out/tracker-server.jar /opt/traccar/tracker-server.jar
