export interface Staff {
  id: string
  name: string
  department: string
  yearsOfExperience: number
  maxCShifts: number
  maxICUShifts: number
  maxHolidayShifts: number
  limitInterpretation: "strict" | "flexible" | "normal" // ○, △, 空欄
}

export interface Preference {
  staffId: string
  date: Date
  preference: "required" | "preferred" | "unavailable" | "neutral" // ◎, ○, ×, 空欄
}

export interface ShiftAssignment {
  day: number
  staffId: string
  shiftType: "C" | "ICU" | "日勤"
  isSubstitute?: boolean
  isManuallyAssigned?: boolean // 手動割り当てフラグを追加
}

export interface Schedule {
  year: number
  month: number
  assignments: ShiftAssignment[]
  holidays: number[]
}

export interface AppState {
  staff: Staff[]
  preferences: Preference[]
  schedule: Schedule | null
  currentMonth: number
  currentYear: number
  holidays: number[]
}
