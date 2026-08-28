export function semanticTerritorialPayload(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('territorial snapshot must be an object')
  }

  const { generatedAt: _generatedAt, sourceCheckedAt: _sourceCheckedAt, ...semantic } = snapshot
  return semantic
}

export function territorialPayloadEqual(a, b) {
  if (!a || !b) return false
  return JSON.stringify(semanticTerritorialPayload(a)) === JSON.stringify(semanticTerritorialPayload(b))
}

function parseTimestamp(value, label) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    throw new Error(`${label} must be a valid timestamp`)
  }
  return timestamp
}

export function prepareTerritorialPublication(
  previous,
  candidate,
  checkedAt,
  heartbeatMinutes = 180,
) {
  if (!candidate || typeof candidate !== 'object') {
    throw new Error('candidate territorial snapshot must be an object')
  }
  if (!Number.isFinite(heartbeatMinutes) || heartbeatMinutes <= 0) {
    throw new Error('heartbeatMinutes must be a positive number')
  }

  const checkedTimestamp = parseTimestamp(checkedAt, 'checkedAt')
  const materialChange = !previous || !territorialPayloadEqual(previous, candidate)

  let heartbeatDue = false
  if (previous && !materialChange) {
    const previousCheckedTimestamp = parseTimestamp(previous.sourceCheckedAt, 'previous.sourceCheckedAt')
    heartbeatDue = checkedTimestamp - previousCheckedTimestamp >= heartbeatMinutes * 60_000
  }

  if (!materialChange && !heartbeatDue) {
    return { publish: false, snapshot: previous }
  }

  return {
    publish: true,
    snapshot: {
      ...candidate,
      generatedAt: checkedAt,
      sourceCheckedAt: checkedAt,
    },
  }
}
