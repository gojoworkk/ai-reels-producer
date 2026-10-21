import ReelsTable from "@/components/ReelsTable";

export default function Home() {
  return (
    <>
      <div className="header">
        <h1>Главное</h1>
        <p>Рилсы конкурентов по просмотрам</p>
      </div>
      <ReelsTable />
    </>
  );
}
