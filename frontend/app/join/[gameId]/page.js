import { redirect } from 'next/navigation';

export default async function JoinDirect({ params }) {
  const { gameId } = await params;
  redirect(`/join?id=${encodeURIComponent(gameId)}`);
}
