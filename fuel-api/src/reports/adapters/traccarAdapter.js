import traccar from '../../config/traccar.js';

const POSITION_LIMIT = 10000;

// Traccar does not persist a tc_trips table — trips are computed on-demand
// by the Java engine. We derive movement metrics from tc_positions instead:
//   - positionCount: total GPS fixes in range (proxy for activity)
//   - estimatedDistanceKm: trapezoidal speed integration (knots → km), capped
//     with a 5-minute gap limit to exclude long idle stretches between fixes
export const getTripsSummary = async ({ deviceId, from, to }) => {
  const pool = traccar.getTraccarPool();

  // Step 1: aggregate raw metrics using a window query (MySQL 8+)
  // POSITION_LIMIT is inlined (not user input) — MySQL disallows ? in LIMIT
  // within derived tables when using prepared statements.
  const [rows] = await pool.execute(
    `SELECT
       COUNT(*) AS positionCount,
       COALESCE(SUM(
         CASE
           WHEN prev_time IS NOT NULL
                AND TIMESTAMPDIFF(SECOND, prev_time, fixtime) BETWEEN 1 AND 300
           THEN ((speed + prev_speed) / 2.0) * 1.852
                * (TIMESTAMPDIFF(SECOND, prev_time, fixtime) / 3600.0)
           ELSE 0
         END
       ), 0) AS estimatedDistanceKm
     FROM (
       SELECT
         fixtime,
         speed,
         LAG(speed)   OVER (ORDER BY fixtime) AS prev_speed,
         LAG(fixtime) OVER (ORDER BY fixtime) AS prev_time
       FROM tc_positions
       WHERE deviceid = ?
         AND fixtime >= ?
         AND fixtime <= ?
       LIMIT ${POSITION_LIMIT}
     ) AS windowed`,
    [deviceId, from, to]
  );

  const [truncatedRows] = await pool.execute(
    `SELECT EXISTS(
       SELECT 1
       FROM tc_positions
       WHERE deviceid = ?
         AND fixtime >= ?
         AND fixtime <= ?
       ORDER BY fixtime
       LIMIT 1 OFFSET ${POSITION_LIMIT}
     ) AS truncated`,
    [deviceId, from, to]
  );

  const [summary] = rows;
  const [truncatedSummary] = truncatedRows;
  const processedPositions = Number(summary?.positionCount || 0);

  return {
    totalDistance: Number(summary?.estimatedDistanceKm || 0),
    // tc_positions don't map 1:1 to trips; return 0 until Traccar API
    // sync is wired for authoritative trip count
    tripCount: 0,
    positionCount: processedPositions,
    processedPositions,
    positionLimit: POSITION_LIMIT,
    truncated: Boolean(truncatedSummary?.truncated),
    distanceSource: 'positions_estimated',
  };
};
