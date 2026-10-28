import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getBackendUrl(): string {
  const raw = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:4000'
  ).trim().replace(/\/+$/, '');

  if (!raw) return 'http://127.0.0.1:4000';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  // If it's a public domain like *.onrender.com or custom domain without port, use https
  if (
    raw.includes('.onrender.com') ||
    (raw.includes('.') && !raw.includes(':') && !raw.includes('localhost') && !raw.includes('127.0.0.1'))
  ) {
    return `https://${raw}`;
  }

  // Internal Render private network (e.g. kronos-backend:10000) or localhost uses HTTP
  return `http://${raw}`;
}

async function proxyRequest(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const backendBase = getBackendUrl();
  const { path } = await context.params;
  const pathSegment = Array.isArray(path) ? path.join('/') : (path || '');
  const search = req.nextUrl.search || '';
  const targetUrl = `${backendBase}/api/${pathSegment}${search}`;

  const forwardHeaders = new Headers();
  req.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== 'host' && lowerKey !== 'connection' && lowerKey !== 'content-length') {
      forwardHeaders.set(key, value);
    }
  });

  const body = ['GET', 'HEAD'].includes(req.method)
    ? undefined
    : await req.arrayBuffer();

  try {
    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
      redirect: 'manual',
      cache: 'no-store',
    });

    const resHeaders = new Headers();
    backendRes.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      // Forward all headers except content-encoding to avoid double compression issues
      if (lowerKey !== 'content-encoding') {
        resHeaders.set(key, value);
      }
    });

    const isSse = backendRes.headers.get('content-type')?.includes('text/event-stream');
    if (isSse) {
      resHeaders.set('Cache-Control', 'no-cache, no-transform');
      resHeaders.set('Connection', 'keep-alive');
      resHeaders.set('X-Accel-Buffering', 'no');
    }

    let cookies: string[] = [];
    if (typeof (backendRes.headers as any).getSetCookie === 'function') {
      cookies = (backendRes.headers as any).getSetCookie() || [];
    }
    if (cookies.length === 0) {
      const rawCookie = backendRes.headers.get('set-cookie');
      if (rawCookie) {
        cookies = [rawCookie];
      }
    }
    if (cookies.length > 0) {
      resHeaders.delete('set-cookie');
      cookies.forEach((cookie) => {
        resHeaders.append('set-cookie', cookie);
      });
    }

    return new NextResponse(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error(`[Next.js API Proxy] Failed to proxy to ${targetUrl}:`, err?.message || err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'BACKEND_UNAVAILABLE',
          message: `Backend server is not reachable at ${targetUrl}: ${err?.message || 'Connection refused'}`,
        },
      },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;
export const HEAD = proxyRequest;
