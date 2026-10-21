import Link from "next/link";
import ReelCard from "@/components/ReelCard";

export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <div className="header">
        <Link href="/" className="back">← Назад к рейтингу</Link>
        <h1>Карточка рилса</h1>
      </div>
      <ReelCard id={Number(id)} />
    </>
  );
}
