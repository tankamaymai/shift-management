"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

interface HolidayManagerProps {
  holidays: number[]
  month: number
  year: number
  onHolidaysChange: (holidays: number[]) => void
}

export default function HolidayManager({ holidays, month, year, onHolidaysChange }: HolidayManagerProps) {
  const [newHoliday, setNewHoliday] = useState<number>(1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const addHoliday = () => {
    if (newHoliday < 1 || newHoliday > daysInMonth) return
    if (holidays.includes(newHoliday)) return

    const updatedHolidays = [...holidays, newHoliday].sort((a, b) => a - b)
    onHolidaysChange(updatedHolidays)
    setNewHoliday(1)
  }

  const removeHoliday = (day: number) => {
    const updatedHolidays = holidays.filter((h) => h !== day)
    onHolidaysChange(updatedHolidays)
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">祝日の設定</h3>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={daysInMonth}
          value={newHoliday}
          onChange={(e) => setNewHoliday(Number.parseInt(e.target.value) || 1)}
          className="w-20"
        />
        <span>日</span>
        <Button size="sm" onClick={addHoliday}>
          祝日を追加
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {holidays.map((day) => (
          <Badge key={day} variant="outline" className="flex items-center gap-1">
            {day}日
            <button
              onClick={() => removeHoliday(day)}
              className="ml-1 rounded-full hover:bg-gray-200 p-1"
              aria-label={`${day}日を削除`}
            >
              <X size={12} />
            </button>
          </Badge>
        ))}
        {holidays.length === 0 && <span className="text-sm text-muted-foreground">祝日が設定されていません</span>}
      </div>
    </div>
  )
}
