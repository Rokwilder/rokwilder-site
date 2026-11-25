// 50 questions per member per calendar month, America/Denver. Failed asks do not count.

export function monthKey(now = Date.now()) {
  const d = new Date(now);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit'
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map(p => [p.type, p.value]));
  return parts.year + parts.month;
}

export function resetLabel(now = Date.now()) {
  const key = monthKey(now);
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(4, 6));
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[nextM - 1] + ' 1, ' + nextY + ', Mountain Time';
}

export async function getUsage(db, userId, now = Date.now()) {
  const yyyymm = monthKey(now);
  const row = await db.prepare('SELECT count FROM advisor_usage WHERE user_id=? AND yyyymm=?').bind(userId, yyyymm).first();
  const used = row && typeof row.count === 'number' ? row.count : 0;
  return { used, limit: 50, remaining: Math.max(0, 50 - used), reset: resetLabel(now), yyyymm };
}

// Reserve one question only if under the cap. Caller must release if the ask fails.
export async function tryReserve(db, userId, now = Date.now()) {
  const yyyymm = monthKey(now);
  const ts = new Date(now).toISOString();
  const res = await db.prepare(
    `INSERT INTO advisor_usage (user_id, yyyymm, count, updated_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(user_id, yyyymm) DO UPDATE SET
       count = count + 1,
       updated_at = excluded.updated_at
     WHERE advisor_usage.count < 50`
  ).bind(userId, yyyymm, ts).run();
  const changed = !!(res && res.meta && res.meta.changes);
  const usage = await getUsage(db, userId, now);
  return { reserved: changed, usage };
}

export async function releaseReservation(db, userId, now = Date.now()) {
  const yyyymm = monthKey(now);
  await db.prepare(
    `UPDATE advisor_usage SET count = MAX(count - 1, 0), updated_at=? WHERE user_id=? AND yyyymm=? AND count > 0`
  ).bind(new Date(now).toISOString(), userId, yyyymm).run();
  return getUsage(db, userId, now);
}

export async function setCount(db, userId, count, now = Date.now()) {
  const yyyymm = monthKey(now);
  const n = Math.max(0, Math.min(50, Number(count) || 0));
  await db.prepare(
    `INSERT INTO advisor_usage (user_id, yyyymm, count, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id, yyyymm) DO UPDATE SET count=excluded.count, updated_at=excluded.updated_at`
  ).bind(userId, yyyymm, n, new Date(now).toISOString()).run();
  return getUsage(db, userId, now);
}
