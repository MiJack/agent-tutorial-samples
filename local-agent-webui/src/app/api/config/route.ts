import { getPiConfiguration } from '@/lib/pi-config';
import { isLocalRequest } from '@/lib/request';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!isLocalRequest(request))
    return new Response('Forbidden', { status: 403 });
  try {
    const { config } = await getPiConfiguration(
      new URL(request.url).searchParams.has('refresh'),
    );
    return Response.json(config, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      {
        error: '读取 Pi 配置失败。请检查本地 Pi 配置和文件权限，然后重新加载。',
      },
      { status: 500 },
    );
  }
}
