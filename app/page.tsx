import { getFixtureSession, getFixtureMemory } from '@/lib/fixtures';
import TenureApp from '@/components/TenureApp';

export default function Page() {
  const session = getFixtureSession();
  const memory  = getFixtureMemory();

  return <TenureApp session={session} memory={memory} />;
}
