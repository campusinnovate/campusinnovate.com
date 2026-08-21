import { NextResponse } from 'next/server';

export const revalidate = 60;

type InstagramMedia = {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp?: string;
};

export async function GET() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const userId = process.env.INSTAGRAM_USER_ID;

  if (!accessToken || !userId) {
    return NextResponse.json({ data: [], connected: false });
  }

  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const graphBaseUrl = process.env.INSTAGRAM_GRAPH_BASE_URL || 'https://graph.instagram.com';
  const graphVersion = process.env.INSTAGRAM_GRAPH_VERSION || 'v25.0';
  const url = new URL(`${graphBaseUrl}/${graphVersion}/${userId}/media`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('limit', '6');
  url.searchParams.set('access_token', accessToken);

  try {
    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) return NextResponse.json({ data: [], connected: false, reason: 'instagram_api_error' }, { status: 200 });
    const payload = await response.json() as { data?: InstagramMedia[] };
    return NextResponse.json({ data: payload.data ?? [], connected: true });
  } catch {
    return NextResponse.json({ data: [], connected: false, reason: 'instagram_unreachable' }, { status: 200 });
  }
}
