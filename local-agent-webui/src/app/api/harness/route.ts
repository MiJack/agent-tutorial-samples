import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadHarnessResources } from '@/lib/harness-resources';
import { chatIdSchema, isLocalRequest } from '@/lib/request';
import { sessionDir } from '@/lib/pi-session';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!isLocalRequest(request))
    return new Response('Forbidden', { status: 403 });
  try {
    const url = new URL(request.url);
    const resources = await loadHarnessResources();
    const skillName = url.searchParams.get('skill');
    if (skillName) {
      const skill = resources.skills.find((skill) => skill.name === skillName);
      if (!skill) return new Response('Skill not found', { status: 404 });
      return Response.json(
        {
          ...resources.info.skills.find((item) => item.name === skillName),
          content: await readFile(skill.filePath, 'utf8'),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const id = url.searchParams.get('chatId');
    let lastTurn: { loadedAt?: string; revision?: string } | undefined;
    if (id && chatIdSchema.safeParse(id).success) {
      try {
        const saved = JSON.parse(
          await readFile(join(sessionDir(id), 'runtime.json'), 'utf8'),
        );
        lastTurn = { loadedAt: saved.loadedAt, revision: saved.revision };
        if (
          saved.revision === resources.info.revision &&
          saved.promptStatus === 'loaded'
        ) {
          resources.info.systemPrompt = saved.systemPrompt;
          resources.info.promptStatus = 'loaded';
          if (Array.isArray(saved.tools)) resources.info.tools = saved.tools;
        }
      } catch {
        /* New conversation. */
      }
    }
    return Response.json(
      { ...resources.info, lastTurn },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Harness 资源加载失败。',
      },
      { status: 500 },
    );
  }
}
