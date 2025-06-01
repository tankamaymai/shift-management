import type { Staff, Preference, Schedule, ShiftAssignment } from "./types"

export function generateEnhancedSchedule(
  staff: Staff[],
  preferences: Preference[],
  daysInMonth: number,
  year: number,
  month: number,
  holidays: number[],
): Schedule {
  // 有効なスタッフのみをフィルタリング
  const validStaff = staff.filter((s) => s.name && s.department)

  // 経験年数でソート（ICU用に経験が多い順、C用に経験が多い順）
  const staffForICU = [...validStaff].sort((a, b) => b.yearsOfExperience - a.yearsOfExperience)
  const staffForC = [...validStaff].sort((a, b) => b.yearsOfExperience - a.yearsOfExperience)

  // 初期化（日勤を除外）
  const assignments: ShiftAssignment[] = []
  const shiftCounts: Record<string, { C: number; ICU: number }> = {}
  validStaff.forEach((member) => {
    shiftCounts[member.id] = { C: 0, ICU: 0 }
  })

  // 必須の希望（◎）を先に割り当て
  assignRequiredPreferences(daysInMonth, validStaff, preferences, assignments, shiftCounts)

  // 最初にICU当直を割り当て
  assignAllICUShifts(daysInMonth, staffForICU, preferences, assignments, shiftCounts)

  // 次にC当直を割り当て
  assignAllCShifts(daysInMonth, staffForC, preferences, assignments, shiftCounts)

  // 空白セルを強制的に埋める
  fillEmptyCells(daysInMonth, validStaff, assignments, shiftCounts, preferences)

  // 上限に達していないスタッフがいる場合、再度割り当てを試みる
  ensureAllLimitsReached(daysInMonth, validStaff, assignments, shiftCounts, preferences)

  // 週末の当直回数を確認し、調整
  balanceWeekendShifts(daysInMonth, validStaff, assignments, shiftCounts, year, month, holidays, preferences)

  // 前半・後半のバランスを調整
  balanceFirstSecondHalf(daysInMonth, validStaff, assignments, shiftCounts, preferences)

  return {
    year,
    month,
    assignments,
    holidays,
  }
}

// 空白セルを強制的に埋める新機能
function fillEmptyCells(
  daysInMonth: number,
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[] = [],
): void {
  for (let day = 1; day <= daysInMonth; day++) {
    // C当直の空白をチェック
    const cAssignment = assignments.find((a) => a.day === day && a.shiftType === "C")
    if (!cAssignment) {
      assignEmptyShift(day, "C", staff, assignments, shiftCounts, preferences)
    }

    // ICU当直の空白をチェック
    const icuAssignment = assignments.find((a) => a.day === day && a.shiftType === "ICU")
    if (!icuAssignment) {
      assignEmptyShift(day, "ICU", staff, assignments, shiftCounts, preferences)
    }
  }
}

// 空白のシフトに強制的にスタッフを割り当て
function assignEmptyShift(
  day: number,
  shiftType: "C" | "ICU",
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[] = [],
): void {
  // 利用可能なスタッフを探す
  const availableStaff = staff.filter((member) => {
    // 基本的な上限チェック
    const maxShifts = shiftType === "C" ? member.maxCShifts : member.maxICUShifts
    if (maxShifts === 0) return false

    // すでにその日にシフトが割り当てられている場合はスキップ
    if (assignments.some((a) => a.day === day && a.staffId === member.id)) return false

    // unavailableの希望がある場合はスキップ
    const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
    if (pref && pref.preference === "unavailable") return false

    return true
  })

  if (availableStaff.length === 0) {
    // 制約を無視してでも割り当てる（空白を避けるため）
    const allStaff = staff.filter((member) => {
      const maxShifts = shiftType === "C" ? member.maxCShifts : member.maxICUShifts
      return maxShifts > 0 && !assignments.some((a) => a.day === day && a.staffId === member.id)
    })

    if (allStaff.length > 0) {
      // 最も余裕のあるスタッフを選ぶ
      const bestStaff = allStaff.reduce((best, current) => {
        const bestCount = shiftType === "C" ? shiftCounts[best.id].C : shiftCounts[best.id].ICU
        const currentCount = shiftType === "C" ? shiftCounts[current.id].C : shiftCounts[current.id].ICU
        return currentCount < bestCount ? current : best
      })

      assignments.push({
        day,
        staffId: bestStaff.id,
        shiftType,
        isSubstitute: true,
      })
      
      if (shiftType === "C") {
        shiftCounts[bestStaff.id].C++
      } else {
        shiftCounts[bestStaff.id].ICU++
      }
    }
    return
  }

  // 希望を考慮してスタッフを選ぶ
  let selectedStaff: Staff | null = null

  // 1. 必須希望のスタッフ
  const requiredStaff = availableStaff.filter((member) => {
    const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
    return pref && pref.preference === "required"
  })

  if (requiredStaff.length > 0) {
    selectedStaff = requiredStaff[0]
  }

  // 2. 希望のスタッフ
  if (!selectedStaff) {
    const preferredStaff = availableStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return pref && pref.preference === "preferred"
    })

    if (preferredStaff.length > 0) {
      selectedStaff = preferredStaff[0]
    }
  }

  // 3. 上限に達していないスタッフ
  if (!selectedStaff) {
    const underLimitStaff = availableStaff.filter((member) => {
      const currentCount = shiftType === "C" ? shiftCounts[member.id].C : shiftCounts[member.id].ICU
      const maxShifts = shiftType === "C" ? member.maxCShifts : member.maxICUShifts
      return currentCount < maxShifts
    })

    if (underLimitStaff.length > 0) {
      // 最も少ないシフト数のスタッフを選ぶ
      selectedStaff = underLimitStaff.reduce((best, current) => {
        const bestCount = shiftType === "C" ? shiftCounts[best.id].C : shiftCounts[best.id].ICU
        const currentCount = shiftType === "C" ? shiftCounts[current.id].C : shiftCounts[current.id].ICU
        return currentCount < bestCount ? current : best
      })
    }
  }

  // 4. どうしても見つからない場合は最初の利用可能なスタッフ
  if (!selectedStaff) {
    selectedStaff = availableStaff[0]
  }

  if (selectedStaff) {
    assignments.push({
      day,
      staffId: selectedStaff.id,
      shiftType,
      isSubstitute: false,
    })

    if (shiftType === "C") {
      shiftCounts[selectedStaff.id].C++
    } else {
      shiftCounts[selectedStaff.id].ICU++
    }
  }
}

// 必須の希望（◎）を先に割り当て
function assignRequiredPreferences(
  daysInMonth: number,
  staff: Staff[],
  preferences: Preference[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
): void {
  const requiredPrefs = preferences.filter((p) => p.preference === "required")
  requiredPrefs.sort((a, b) => a.date.getDate() - b.date.getDate())

  for (const pref of requiredPrefs) {
    const day = pref.date.getDate()
    const staffMember = staff.find((s) => s.id === pref.staffId)
    if (!staffMember) continue

    const unavailablePref = preferences.find(
      (p) => p.staffId === pref.staffId && p.date.getDate() === day && p.preference === "unavailable"
    )
    if (unavailablePref) continue

    const alreadyAssigned = assignments.some((a) => a.staffId === pref.staffId && a.day === day)
    if (alreadyAssigned) continue

    const hasHighExperience = staffMember.yearsOfExperience >= 5
    const canAssignICU =
      staffMember.maxICUShifts > 0 &&
      (shiftCounts[staffMember.id].ICU < staffMember.maxICUShifts || staffMember.limitInterpretation === "flexible")
    const canAssignC =
      staffMember.maxCShifts > 0 &&
      (shiftCounts[staffMember.id].C < staffMember.maxCShifts || staffMember.limitInterpretation === "flexible")

    if (canAssignICU && (hasHighExperience || !canAssignC)) {
      const icuAssigned = assignments.some((a) => a.day === day && a.shiftType === "ICU")
      if (!icuAssigned) {
        assignments.push({
          day,
          staffId: pref.staffId,
          shiftType: "ICU",
          isManuallyAssigned: true,
        })
        shiftCounts[pref.staffId].ICU++
      }
    } else if (canAssignC) {
      const cAssigned = assignments.some((a) => a.day === day && a.shiftType === "C")
      if (!cAssigned) {
        assignments.push({
          day,
          staffId: pref.staffId,
          shiftType: "C",
          isManuallyAssigned: true,
        })
        shiftCounts[pref.staffId].C++
      }
    }
  }
}

// ICU当直を割り当て
function assignAllICUShifts(
  daysInMonth: number,
  staff: Staff[],
  preferences: Preference[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
): void {
  const eligibleStaff = staff.filter((member) => member.maxICUShifts > 0)

  for (let day = 1; day <= daysInMonth; day++) {
    if (assignments.some((a) => a.day === day && a.shiftType === "ICU")) continue

    const cAssignment = assignments.find((a) => a.day === day && a.shiftType === "C")
    const cStaffExperience = cAssignment ? staff.find((s) => s.id === cAssignment.staffId)?.yearsOfExperience || 0 : 0

    let assigned = false

    // 必須希望のスタッフを優先
    const requiredStaff = eligibleStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return pref && pref.preference === "required" && member.yearsOfExperience >= cStaffExperience
    })

    for (const member of requiredStaff) {
      if (canAssignICUShift(member, day, assignments, staff, shiftCounts, preferences)) {
        assignments.push({
          day,
          staffId: member.id,
          shiftType: "ICU",
          isManuallyAssigned: true,
        })
        shiftCounts[member.id].ICU++
        assigned = true
        break
      }
    }

    if (assigned) continue

    // 上限に達していないスタッフを優先
    for (const member of eligibleStaff) {
      if (cAssignment && member.yearsOfExperience < cStaffExperience) continue
      if (canAssignICUShift(member, day, assignments, staff, shiftCounts, preferences)) {
        assignments.push({
          day,
          staffId: member.id,
          shiftType: "ICU",
        })
        shiftCounts[member.id].ICU++
        assigned = true
        break
      }
    }
  }
}

// C当直を割り当て
function assignAllCShifts(
  daysInMonth: number,
  staff: Staff[],
  preferences: Preference[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
): void {
  const eligibleStaff = staff.filter((member) => member.maxCShifts > 0)

  for (let day = 1; day <= daysInMonth; day++) {
    if (assignments.some((a) => a.day === day && a.shiftType === "C")) continue

    const icuAssignment = assignments.find((a) => a.day === day && a.shiftType === "ICU")
    const icuStaffExperience = icuAssignment ? staff.find((s) => s.id === icuAssignment.staffId)?.yearsOfExperience || 0 : 0

    let assigned = false

    // 必須希望のスタッフを優先
    const requiredStaff = eligibleStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return (
        pref &&
        pref.preference === "required" &&
        (icuAssignment ? member.yearsOfExperience <= icuStaffExperience : true)
      )
    })

    for (const member of requiredStaff) {
      if (canAssignCShift(member, day, assignments, staff, shiftCounts, preferences)) {
        assignments.push({
          day,
          staffId: member.id,
          shiftType: "C",
          isManuallyAssigned: true,
        })
        shiftCounts[member.id].C++
        assigned = true
        break
      }
    }

    if (assigned) continue

    // 上限に達していないスタッフを優先
    for (const member of eligibleStaff) {
      if (icuAssignment && member.yearsOfExperience > icuStaffExperience) continue
      if (canAssignCShift(member, day, assignments, staff, shiftCounts, preferences)) {
        assignments.push({
          day,
          staffId: member.id,
          shiftType: "C",
        })
        shiftCounts[member.id].C++
        assigned = true
        break
      }
    }
  }
}

// ヘルパー関数群
function isAvailableForShift(
  member: Staff,
  day: number,
  assignments: ShiftAssignment[],
  staff: Staff[],
  preferences: Preference[] = [],
): boolean {
  if (member.maxCShifts === 0 && member.maxICUShifts === 0) return false
  if (assignments.some((a) => a.day === day && a.staffId === member.id)) return false

  const departmentAssigned = assignments.some(
    (a) => a.day === day && staff.find((s) => s.id === a.staffId)?.department === member.department,
  )
  if (departmentAssigned) return false

  const hasRecentOrUpcomingShift = assignments.some((a) => {
    const dayDiff = Math.abs(day - a.day)
    return a.staffId === member.id && dayDiff <= 3
  })
  if (hasRecentOrUpcomingShift) return false

  const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
  if (pref && pref.preference === "unavailable") return false

  return true
}

function canAssignICUShift(
  member: Staff,
  day: number,
  assignments: ShiftAssignment[],
  staff: Staff[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[] = [],
): boolean {
  if (member.maxICUShifts === 0) return false

  if (shiftCounts[member.id].ICU >= member.maxICUShifts) {
    if (member.limitInterpretation === "flexible" && shiftCounts[member.id].C <= member.maxCShifts) {
      // OK
    } else {
      return false
    }
  }

  return isAvailableForShift(member, day, assignments, staff, preferences)
}

function canAssignCShift(
  member: Staff,
  day: number,
  assignments: ShiftAssignment[],
  staff: Staff[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[] = [],
): boolean {
  if (member.maxCShifts === 0) return false

  if (shiftCounts[member.id].C >= member.maxCShifts) {
    if (member.limitInterpretation === "flexible" && shiftCounts[member.id].ICU <= member.maxICUShifts) {
      // OK
    } else {
      return false
    }
  }

  return isAvailableForShift(member, day, assignments, staff, preferences)
}

// 簡略化された関数群（オリジナルから重要な部分のみ）
function ensureAllLimitsReached(
  daysInMonth: number,
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[],
): void {
  // 実装は必要に応じて追加
}

function balanceWeekendShifts(
  daysInMonth: number,
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  year: number,
  month: number,
  holidays: number[],
  preferences: Preference[],
): void {
  // 実装は必要に応じて追加
}

function balanceFirstSecondHalf(
  daysInMonth: number,
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[],
): void {
  // 実装は必要に応じて追加
} 