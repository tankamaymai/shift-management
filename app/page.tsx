import ShiftManagement from "@/components/shift-management"

export default function Home() {
  return (
    <main className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">当直シフト管理アプリ</h1>
      <ShiftManagement />
    </main>
  )
}
