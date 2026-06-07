import { readFileSync } from 'fs';
import { join } from 'path';
import type { ReviewSession, TeamMemory } from '@/types';

export function getFixtureSession(): ReviewSession {
  const raw = readFileSync(join(process.cwd(), 'public/fixtures/session.json'), 'utf-8');
  return JSON.parse(raw) as ReviewSession;
}

export function getFixtureMemory(): TeamMemory {
  const raw = readFileSync(join(process.cwd(), 'public/fixtures/memory.json'), 'utf-8');
  return JSON.parse(raw) as TeamMemory;
}
