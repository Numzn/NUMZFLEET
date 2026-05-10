# Operation Sessions API (Backward-Compatible Extension)

## Legacy create refuels payload (still supported)

`POST /api/operation-sessions/:id/refuels`

```json
{
  "records": [
    {
      "vehicleId": 101,
      "fuelCost": 900.5,
      "fuelAmount": 25.4,
      "currentMileage": 221420,
      "attendant": "Alice",
      "pumpNumber": "P-03"
    }
  ]
}
```

## New intelligent update payload

`POST /api/operation-sessions/:id/refuels`

```json
{
  "updates": [
    {
      "refuelId": 345,
      "actualFuelLitres": 31.8,
      "mileage": 221450
    }
  ]
}
```

## Extended `GET /api/operation-sessions/:id` response example

```json
{
  "id": 88,
  "userId": 1,
  "name": "Fuel Session 27/04/2026",
  "sessionDate": "2026-04-27T08:20:00.000Z",
  "status": "active",
  "notes": "",
  "totalEstimatedFuel": 68,
  "totalActualFuel": 64,
  "totalEstimatedCost": 2412,
  "totalActualCost": 2272,
  "totalVarianceCost": -140,
  "totalsFrozenAt": null,
  "vehicleCount": 2,
  "statusCounts": {
    "normal": 0,
    "warning": 2,
    "flagged": 0
  },
  "refuels": [
    {
      "id": 345,
      "sessionId": 88,
      "vehicleId": 101,
      "fuelCost": 1136,
      "fuelAmount": 32,
      "estimatedFuelLitres": 34,
      "actualFuelLitres": 32,
      "varianceLitres": -2,
      "variancePercent": -5.88,
      "status": "warning",
      "erbPricePerLitre": 35.5,
      "estimatedCost": 1207,
      "actualCost": 1136,
      "tankLevelStart": 0.22,
      "tankCapacitySnapshot": 90,
      "locked": false
    }
  ]
}
```
