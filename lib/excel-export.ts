import type { Staff, Preference, Schedule } from "./types"

export function exportToExcel(
  schedule: Schedule,
  staff: Staff[],
  preferences: Preference[],
  daysInMonth: number,
  year: number,
  month: number,
) {
  // Import xlsx dynamically to avoid server-side issues
  import("xlsx").then((XLSX) => {
    // Create workbook
    const wb = XLSX.utils.book_new()

    // Create schedule worksheet
    const scheduleData: any[][] = []

    // Add header row with days
    const headerRow = ["日付"]
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isSunday = date.getDay() === 0
      const isHoliday = schedule.holidays.includes(day)

      let dayLabel = `${day}日`
      if (isSunday) dayLabel += "(日)"
      if (isHoliday) dayLabel += "(祝)"

      headerRow.push(dayLabel)
    }
    scheduleData.push(headerRow)

    // Add day shift row
    const dayShiftRow = ["日勤"]
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const isSunday = date.getDay() === 0
      const isHoliday = schedule.holidays.includes(day)

      if (isSunday || isHoliday) {
        const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "日勤")
        if (assignment) {
          const member = staff.find((s) => s.id === assignment.staffId)
          dayShiftRow.push(member ? `${member.name} (${member.department})` : "未割当")
        } else {
          dayShiftRow.push("未割当")
        }
      } else {
        dayShiftRow.push("-")
      }
    }
    scheduleData.push(dayShiftRow)

    // Add C shift row
    const cRow = ["C当直"]
    for (let day = 1; day <= daysInMonth; day++) {
      const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "C")

      if (assignment) {
        const member = staff.find((s) => s.id === assignment.staffId)
        cRow.push(member ? `${member.name} (${member.department})` : "未割当")
      } else {
        cRow.push("未割当")
      }
    }
    scheduleData.push(cRow)

    // Add ICU shift row
    const icuRow = ["ICU当直"]
    for (let day = 1; day <= daysInMonth; day++) {
      const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "ICU")

      if (assignment) {
        const member = staff.find((s) => s.id === assignment.staffId)
        icuRow.push(member ? `${member.name} (${member.department})` : "未割当")
      } else {
        icuRow.push("未割当")
      }
    }
    scheduleData.push(icuRow)

    // Create schedule worksheet
    const scheduleWs = XLSX.utils.aoa_to_sheet(scheduleData)
    XLSX.utils.book_append_sheet(wb, scheduleWs, "スケジュール")

    // Create staff summary worksheet
    const summaryData: any[][] = []
    summaryData.push([
      "名前",
      "診療科",
      "経験年数",
      "C当直回数",
      "ICU当直回数",
      "日勤回数",
      "C当直上限",
      "ICU当直上限",
      "当直日",
    ])

    staff
      .filter((s) => s.name)
      .forEach((member) => {
        const cShifts = schedule.assignments.filter((a) => a.staffId === member.id && a.shiftType === "C")
        const icuShifts = schedule.assignments.filter((a) => a.staffId === member.id && a.shiftType === "ICU")
        const dayShifts = schedule.assignments.filter((a) => a.staffId === member.id && a.shiftType === "日勤")

        const allShiftDays = [...cShifts, ...icuShifts, ...dayShifts]
          .sort((a, b) => a.day - b.day)
          .map((a) => `${a.day}日(${a.shiftType})`)

        summaryData.push([
          member.name,
          member.department,
          member.yearsOfExperience,
          cShifts.length,
          icuShifts.length,
          dayShifts.length,
          member.maxCShifts,
          member.maxICUShifts,
          allShiftDays.join(", "),
        ])
      })

    // Create summary worksheet
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, "スタッフサマリー")

    // Create preferences worksheet
    const preferencesData: any[][] = []

    // Add header row with days
    const prefHeaderRow = ["スタッフ"]
    for (let day = 1; day <= daysInMonth; day++) {
      prefHeaderRow.push(`${day}日`)
    }
    preferencesData.push(prefHeaderRow)

    // Add preference rows for each staff member
    staff
      .filter((s) => s.name)
      .forEach((member) => {
        const prefRow = [member.name]

        for (let day = 1; day <= daysInMonth; day++) {
          const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)

          if (pref) {
            if (pref.preference === "preferred") prefRow.push("○")
            else if (pref.preference === "unavailable") prefRow.push("×")
            else prefRow.push("")
          } else {
            prefRow.push("")
          }
        }

        preferencesData.push(prefRow)
      })

    // Create preferences worksheet
    const preferencesWs = XLSX.utils.aoa_to_sheet(preferencesData)
    XLSX.utils.book_append_sheet(wb, preferencesWs, "希望")

    // Generate filename
    const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]
    const filename = `当直シフト_${year}年${monthNames[month]}.xlsx`

    // Export file
    XLSX.writeFile(wb, filename)
  })
}
