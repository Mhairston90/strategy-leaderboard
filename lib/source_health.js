export function mergeHealth(current, next) {
  if (current === 'error' || next === 'error') return 'error';
  if (current === 'warn' || next === 'warn') return 'warn';
  return 'ok';
}

export function healthSeverityForRow(row, sourceType) {
  if (!row) return 'error';
  if (row.status === 'error') {
    return sourceType === 'sheets' ? 'warn' : 'error';
  }
  if (sourceType !== 'sheets' && Array.isArray(row.errors) && row.errors.length > 0) {
    return 'warn';
  }
  return 'ok';
}

export function healthBucketForSource(sourceType) {
  return sourceType === 'sheets' ? 'sheets' : 'files';
}
