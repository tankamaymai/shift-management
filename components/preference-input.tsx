"use client"

import { useEffect } from "react"
import type { Staff, Preference } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Circle, CheckCircle2 } from "lucide-react"

interface PreferenceInputProps {
  staff: Staff[]
  daysInMonth: number
  preferences: Preference[]
  onPreferenceUpdate: (preferences: Preference[]) => void
  year: number
  month: number
  holidays: number[]
}

export default function PreferenceInput({
  staff,
  daysInMonth,
  preferences,
  onPreferenceUpdate,
  year,
  month,
  holidays,
}: PreferenceInputProps) {
  // Initialize preferences if empty
  useEffect(() => {
    if (preferences.length === 0 && staff.length > 0) {
      const initialPreferences: Preference[] = []

      staff.forEach((member) => {
        if (!member.name) return

        for (let day = 1; day <= daysInMonth; day++) {
          initialPreferences.push({
            staffId: member.id,
            date: new Date(year, month, day),
            preference: "neutral", // Default to neutral
          })
        }
      })

      onPreferenceUpdate(initialPreferences)
    }
  }, [staff, daysInMonth, preferences, onPreferenceUpdate, year, month])

  const handlePreferenceChange = (staffId: string, day: number, value: string) => {
    const date = new Date(year, month, day)
    const updatedPreferences = [...preferences]

    const existingIndex = preferences.findIndex((p) => p.staffId === staffId && p.date.getDate() === day)

    if (existingIndex >= 0) {
      updatedPreferences[existingIndex] = {
        ...updatedPreferences[existingIndex],
        preference: value as "required" | "preferred" | "unavailable" | "neutral",
      }
    } else {
      updatedPreferences.push({
        staffId,
        date,
        preference: value as "required" | "preferred" | "unavailable" | "neutral",
      })
    }

    onPreferenceUpdate(updatedPreferences)
  }

  const getPreference = (staffId: string, day: number): string => {
    const pref = preferences.find((p) => p.staffId === staffId && p.date.getDate() === day)
    return pref ? pref.preference : "neutral"
  }

  // Generate day headers
  const dayHeaders = []
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dayOfWeek = date.getDay()
    const isSunday = dayOfWeek === 0
    const isHoliday = holidays.includes(day)
    const isSaturday = dayOfWeek === 6

    dayHeaders.push(
      <TableHead
        key={day}
        className={`text-center w-10 p-1 ${isSunday || isHoliday ? "text-red-500" : ""} ${
          isSaturday ? "text-blue-500" : ""
        }`}
      >
        {day}
        <div className="text-xs">
          {["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]}
          {isHoliday ? "祝" : ""}
        </div>
      </TableHead>,
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">希望入力</h2>
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-5 w-5 text-purple-500" />
          <span>必ず割り当て (◎)</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-5 w-5 text-green-500" />
          <span>希望する (○)</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="h-5 w-5 text-red-500" />
          <span>希望しない (×)</span>
        </div>
        <div className="flex items-center gap-1">
          <Circle className="h-5 w-5 text-gray-300" />
          <span>どちらでも</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white z-10 min-w-[120px]">スタッフ</TableHead>
              {dayHeaders}
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff
              .filter((s) => s.name)
              .map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="sticky left-0 bg-white z-10 font-medium">{member.name}</TableCell>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const preference = getPreference(member.id, day)
                    return (
                      <TableCell key={day} className="p-1 text-center">
                        <div className="flex justify-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 rounded-full"
                            onClick={() => {
                              const newPref =
                                preference === "neutral"
                                  ? "preferred"
                                  : preference === "preferred"
                                    ? "required"
                                    : preference === "required"
                                      ? "unavailable"
                                      : "neutral"
                              handlePreferenceChange(member.id, day, newPref)
                            }}
                          >
                            {preference === "required" ? (
                              <CheckCircle2 className="h-4 w-4 text-purple-500" />
                            ) : preference === "preferred" ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : preference === "unavailable" ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <Circle className="h-4 w-4 text-gray-300" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
