import { NextResponse } from 'next/server';

export function ok(data) {
  return NextResponse.json({ ok: true, ...data });
}

export function fail(message, status = 500) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (id) => UUID_RE.test(String(id || ''));
