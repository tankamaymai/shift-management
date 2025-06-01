import ShiftManagement from "@/components/shift-management"

export default function Home() {
  return (
    <main className="container mx-auto py-8 px-6">
      <h1 className="text-4xl font-bold mb-8">当直シフト管理アプリ</h1>
      <ShiftManagement />
    </main>
  )
}
