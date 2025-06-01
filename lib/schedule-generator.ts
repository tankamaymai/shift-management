import type { Staff, Preference, Schedule, ShiftAssignment } from "./types"

export function generateSchedule(
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

  // 初期化
  const assignments: ShiftAssignment[] = []
  const shiftCounts: Record<string, { C: number; ICU: number }> = {}
  validStaff.forEach((member) => {
    shiftCounts[member.id] = { C: 0, ICU: 0 }
  })

  // 日勤シフトの割り当てを削除

  // 必須の希望（◎）を先に割り当て
  assignRequiredPreferences(daysInMonth, validStaff, preferences, assignments, shiftCounts, year, month)

  // 最初にICU当直を割り当て
  assignAllICUShifts(daysInMonth, staffForICU, preferences, assignments, shiftCounts, year, month, holidays)

  // 次にC当直を割り当て
  assignAllCShifts(daysInMonth, staffForC, preferences, assignments, shiftCounts, year, month, holidays)

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

// 必須の希望（◎）を先に割り当て
function assignRequiredPreferences(
  daysInMonth: number,
  staff: Staff[],
  preferences: Preference[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  year: number,
  month: number,
): void {
  // 必須の希望を取得
  const requiredPrefs = preferences.filter((p) => p.preference === "required")

  // 日付順にソート
  requiredPrefs.sort((a, b) => a.date.getDate() - b.date.getDate())

  // 各必須希望を処理
  for (const pref of requiredPrefs) {
    const day = pref.date.getDate()
    const staffMember = staff.find((s) => s.id === pref.staffId)
    if (!staffMember) continue

    // その日にunavailableの希望がある場合はスキップ
    const unavailablePref = preferences.find(
      (p) => p.staffId === pref.staffId && p.date.getDate() === day && p.preference === "unavailable"
    )
    if (unavailablePref) continue

    // すでにその日に割り当てられているか確認
    const alreadyAssigned = assignments.some((a) => a.staffId === pref.staffId && a.day === day)
    if (alreadyAssigned) continue

    // ICUとCのどちらに割り当てるか決定
    // 経験年数が高い場合はICUを優先
    const hasHighExperience = staffMember.yearsOfExperience >= 5
    const canAssignICU =
      staffMember.maxICUShifts > 0 &&
      (shiftCounts[staffMember.id].ICU < staffMember.maxICUShifts || staffMember.limitInterpretation === "flexible")
    const canAssignC =
      staffMember.maxCShifts > 0 &&
      (shiftCounts[staffMember.id].C < staffMember.maxCShifts || staffMember.limitInterpretation === "flexible")

    // ICUが割り当て可能で、経験年数が高いか、Cが割り当て不可の場合
    if (canAssignICU && (hasHighExperience || !canAssignC)) {
      // その日のICUがまだ割り当てられていないか確認
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
    }
    // Cが割り当て可能な場合
    else if (canAssignC) {
      // その日のCがまだ割り当てられていないか確認
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
  // 利用可能なスタッフを探す（制約を徐々に緩和）
  const eligibleStaff = staff.filter((member) => {
    const maxShifts = shiftType === "C" ? member.maxCShifts : member.maxICUShifts
    return maxShifts > 0
  })

  // 1. まず通常の制約でスタッフを探す
  let availableStaff = eligibleStaff.filter((member) => {
    // すでにその日にシフトが割り当てられている場合はスキップ
    if (assignments.some((a) => a.day === day && a.staffId === member.id)) return false

    // unavailableの希望がある場合はスキップ
    const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
    if (pref && pref.preference === "unavailable") return false

    // 診療科の重複チェック
    const departmentAssigned = assignments.some(
      (a) => a.day === day && staff.find((s) => s.id === a.staffId)?.department === member.department,
    )
    if (departmentAssigned) return false

    // 連続勤務チェック（3日以内）
    const hasRecentOrUpcomingShift = assignments.some((a) => {
      const dayDiff = Math.abs(day - a.day)
      return a.staffId === member.id && dayDiff <= 3
    })
    if (hasRecentOrUpcomingShift) return false

    return true
  })

  // 2. 見つからない場合は連続勤務制約を緩和（2日以内）
  if (availableStaff.length === 0) {
    availableStaff = eligibleStaff.filter((member) => {
      if (assignments.some((a) => a.day === day && a.staffId === member.id)) return false
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      if (pref && pref.preference === "unavailable") return false
      
      const departmentAssigned = assignments.some(
        (a) => a.day === day && staff.find((s) => s.id === a.staffId)?.department === member.department,
      )
      if (departmentAssigned) return false

      const hasRecentOrUpcomingShift = assignments.some((a) => {
        const dayDiff = Math.abs(day - a.day)
        return a.staffId === member.id && dayDiff <= 2
      })
      if (hasRecentOrUpcomingShift) return false

      return true
    })
  }

  // 3. それでも見つからない場合は診療科重複を許可
  if (availableStaff.length === 0) {
    availableStaff = eligibleStaff.filter((member) => {
      if (assignments.some((a) => a.day === day && a.staffId === member.id)) return false
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      if (pref && pref.preference === "unavailable") return false

      const hasRecentOrUpcomingShift = assignments.some((a) => {
        const dayDiff = Math.abs(day - a.day)
        return a.staffId === member.id && dayDiff <= 1
      })
      if (hasRecentOrUpcomingShift) return false

      return true
    })
  }

  // 4. それでも見つからない場合は、unavailable以外のすべての制約を無視
  if (availableStaff.length === 0) {
    availableStaff = eligibleStaff.filter((member) => {
      if (assignments.some((a) => a.day === day && a.staffId === member.id)) return false
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      if (pref && pref.preference === "unavailable") return false
      return true
    })
  }

  // 5. 最終手段：unavailableも無視（ただし、その日に既にシフトがある人は除く）
  if (availableStaff.length === 0) {
    availableStaff = eligibleStaff.filter((member) => {
      return !assignments.some((a) => a.day === day && a.staffId === member.id)
    })
  }

  if (availableStaff.length === 0) {
    console.warn(`警告: ${day}日の${shiftType}当直に割り当て可能なスタッフがいません`)
    return
  }

  // 最適なスタッフを選択
  let selectedStaff: Staff | null = null

  // 1. 必須希望のスタッフ
  const requiredStaff = availableStaff.filter((member) => {
    const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
    return pref && pref.preference === "required"
  })

  if (requiredStaff.length > 0) {
    selectedStaff = requiredStaff.reduce((best, current) => {
      const bestCount = shiftType === "C" ? shiftCounts[best.id].C : shiftCounts[best.id].ICU
      const currentCount = shiftType === "C" ? shiftCounts[current.id].C : shiftCounts[current.id].ICU
      return currentCount < bestCount ? current : best
    })
  }

  // 2. 希望のスタッフ
  if (!selectedStaff) {
    const preferredStaff = availableStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return pref && pref.preference === "preferred"
    })

    if (preferredStaff.length > 0) {
      selectedStaff = preferredStaff.reduce((best, current) => {
        const bestCount = shiftType === "C" ? shiftCounts[best.id].C : shiftCounts[best.id].ICU
        const currentCount = shiftType === "C" ? shiftCounts[current.id].C : shiftCounts[current.id].ICU
        return currentCount < bestCount ? current : best
      })
    }
  }

  // 3. 最も少ないシフト数のスタッフ
  if (!selectedStaff) {
    selectedStaff = availableStaff.reduce((best, current) => {
      const bestCount = shiftType === "C" ? shiftCounts[best.id].C : shiftCounts[best.id].ICU
      const currentCount = shiftType === "C" ? shiftCounts[current.id].C : shiftCounts[current.id].ICU
      return currentCount < bestCount ? current : best
    })
  }

  if (selectedStaff) {
    const currentCount = shiftType === "C" ? shiftCounts[selectedStaff.id].C : shiftCounts[selectedStaff.id].ICU
    const maxShifts = shiftType === "C" ? selectedStaff.maxCShifts : selectedStaff.maxICUShifts
    
    assignments.push({
      day,
      staffId: selectedStaff.id,
      shiftType,
      isSubstitute: currentCount >= maxShifts,
    })

    if (shiftType === "C") {
      shiftCounts[selectedStaff.id].C++
    } else {
      shiftCounts[selectedStaff.id].ICU++
    }
  }
}

// スタッフが特定の日にシフトに入れるかチェック
function isAvailableForShift(
  member: Staff,
  day: number,
  assignments: ShiftAssignment[],
  staff: Staff[],
  preferences: Preference[] = [],
): boolean {
  // 上限が0の場合は割り当てない
  if (member.maxCShifts === 0 && member.maxICUShifts === 0) return false

  // すでにその日にシフトが割り当てられている場合はスキップ
  if (assignments.some((a) => a.day === day && a.staffId === member.id)) return false

  // 同じ診療科の人がすでにその日にシフトが割り当てられている場合はスキップ
  const departmentAssigned = assignments.some(
    (a) => a.day === day && staff.find((s) => s.id === a.staffId)?.department === member.department,
  )
  if (departmentAssigned) return false

  // 過去3日以内または将来3日以内にシフトが割り当てられている場合はスキップ
  // これにより、連続4日以上の間隔を確保
  const hasRecentOrUpcomingShift = assignments.some((a) => {
    const dayDiff = Math.abs(day - a.day)
    return a.staffId === member.id && dayDiff <= 3
  })
  if (hasRecentOrUpcomingShift) return false

  // 希望が「unavailable」の場合は割り当てない
  const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
  if (pref && pref.preference === "unavailable") return false

  return true
}



// 全てのICU当直を割り当て
function assignAllICUShifts(
  daysInMonth: number,
  staff: Staff[],
  preferences: Preference[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  year: number,
  month: number,
  holidays: number[],
): void {
  // 上限が0のスタッフを除外
  const eligibleStaff = staff.filter((member) => member.maxICUShifts > 0)

  // 上限解釈が「strict」のスタッフを優先
  const strictStaff = eligibleStaff.filter((member) => member.limitInterpretation === "strict")

  // 各日のICU当直を割り当て
  for (let day = 1; day <= daysInMonth; day++) {
    // すでにICUが割り当てられている日はスキップ
    if (assignments.some((a) => a.day === day && a.shiftType === "ICU")) continue

    // その日のC当直の経験年数を取得
    const cAssignment = assignments.find((a) => a.day === day && a.shiftType === "C")
    const cStaffExperience = cAssignment ? staff.find((s) => s.id === cAssignment.staffId)?.yearsOfExperience || 0 : 0

    // 必須の希望（◎）を持つスタッフを優先
    const requiredStaff = eligibleStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return pref && pref.preference === "required" && member.yearsOfExperience >= cStaffExperience
    })

    if (requiredStaff.length > 0) {
      for (const member of requiredStaff) {
        if (canAssignICUShift(member, day, assignments, staff, shiftCounts, preferences)) {
          assignments.push({
            day,
            staffId: member.id,
            shiftType: "ICU",
            isManuallyAssigned: true,
          })
          shiftCounts[member.id].ICU++
          break
        }
      }
      // 必須希望があったが割り当てられなかった場合でも次の日に進む
      if (assignments.some((a) => a.day === day && a.shiftType === "ICU")) continue
    }

    // 次に、上限解釈が「strict」のスタッフを優先
    let assigned = false
    for (const member of strictStaff) {
      // 上限に達していない場合のみ
      if (shiftCounts[member.id].ICU >= member.maxICUShifts) continue

      // 経験年数条件を確認
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

    if (assigned) continue

    // 希望が「preferred」のスタッフを次に優先
    const preferredStaff = eligibleStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return pref && pref.preference === "preferred" && member.yearsOfExperience >= cStaffExperience
    })

    for (const member of preferredStaff) {
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

    if (assigned) continue

    // 上限に達していない人を優先
    for (const member of eligibleStaff) {
      // 経験年数条件を確認
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

    if (assigned) continue

    // どうしても割り当てられない場合は、上限+1まで許容するスタッフを探す
    for (const member of eligibleStaff.filter((m) => m.limitInterpretation === "flexible")) {
      // 経験年数条件を確認
      if (cAssignment && member.yearsOfExperience < cStaffExperience) continue

      // 上限+1まで許容
      if (
        shiftCounts[member.id].ICU > member.maxICUShifts ||
        (shiftCounts[member.id].ICU === member.maxICUShifts && shiftCounts[member.id].C > member.maxCShifts)
      ) {
        continue
      }

      if (isAvailableForShift(member, day, assignments, staff, preferences)) {
        assignments.push({
          day,
          staffId: member.id,
          shiftType: "ICU",
          isSubstitute: shiftCounts[member.id].ICU >= member.maxICUShifts,
        })
        shiftCounts[member.id].ICU++
        assigned = true
        break
      }
    }

    // それでも割り当てられない場合は、経験年数条件を緩和して再試行
    if (!assigned) {
      for (const member of eligibleStaff) {
        if (canAssignICUShift(member, day, assignments, staff, shiftCounts, preferences, true)) {
          assignments.push({
            day,
            staffId: member.id,
            shiftType: "ICU",
            isSubstitute: shiftCounts[member.id].ICU >= member.maxICUShifts,
          })
          shiftCounts[member.id].ICU++
          break
        }
      }
    }
  }
}

// ICUシフトを割り当て可能かチェック
function canAssignICUShift(
  member: Staff,
  day: number,
  assignments: ShiftAssignment[],
  staff: Staff[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[] = [],
  ignoreExperience = false,
): boolean {
  // 上限が0の場合は割り当てない
  if (member.maxICUShifts === 0) return false

  // 上限に達している場合
  if (shiftCounts[member.id].ICU >= member.maxICUShifts) {
    // 上限解釈が「flexible」で、C当直の上限を超えていない場合のみ許容
    if (member.limitInterpretation === "flexible" && shiftCounts[member.id].C <= member.maxCShifts) {
      // OK
    } else {
      return false
    }
  }

  // 基本的な可用性チェック
  if (!isAvailableForShift(member, day, assignments, staff, preferences)) return false

  // 経験年数条件チェック（ignoreExperienceがtrueの場合はスキップ）
  if (!ignoreExperience) {
    const cAssignment = assignments.find((a) => a.day === day && a.shiftType === "C")
    if (cAssignment) {
      const cStaffExperience = staff.find((s) => s.id === cAssignment.staffId)?.yearsOfExperience || 0
      if (member.yearsOfExperience < cStaffExperience) return false
    }
  }

  return true
}

// 全てのC当直を割り当て
function assignAllCShifts(
  daysInMonth: number,
  staff: Staff[],
  preferences: Preference[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  year: number,
  month: number,
  holidays: number[],
): void {
  // 上限が0のスタッフを除外
  const eligibleStaff = staff.filter((member) => member.maxCShifts > 0)

  // 上限解釈が「strict」のスタッフを優先
  const strictStaff = eligibleStaff.filter((member) => member.limitInterpretation === "strict")

  // 各日のC当直を割り当て
  for (let day = 1; day <= daysInMonth; day++) {
    // すでにCが割り当てられている日はスキップ
    if (assignments.some((a) => a.day === day && a.shiftType === "C")) continue

    // その日のICU当直の経験年数を取得
    const icuAssignment = assignments.find((a) => a.day === day && a.shiftType === "ICU")
    const icuStaffExperience = icuAssignment
      ? staff.find((s) => s.id === icuAssignment.staffId)?.yearsOfExperience || 0
      : 0

    // 必須の希望（◎）を持つスタッフを優先
    const requiredStaff = eligibleStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return (
        pref &&
        pref.preference === "required" &&
        (icuAssignment ? member.yearsOfExperience <= icuStaffExperience : true)
      )
    })

    if (requiredStaff.length > 0) {
      for (const member of requiredStaff) {
        if (canAssignCShift(member, day, assignments, staff, shiftCounts, preferences)) {
          assignments.push({
            day,
            staffId: member.id,
            shiftType: "C",
            isManuallyAssigned: true,
          })
          shiftCounts[member.id].C++
          break
        }
      }
      // 必須希望があったが割り当てられなかった場合でも次の日に進む
      if (assignments.some((a) => a.day === day && a.shiftType === "C")) continue
    }

    // 次に、上限解釈が「strict」のスタッフを優先
    let assigned = false
    for (const member of strictStaff) {
      // 上限に達していない場合のみ
      if (shiftCounts[member.id].C >= member.maxCShifts) continue

      // 経験年数条件を確認
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

    if (assigned) continue

    // 希望が「preferred」のスタッフを次に優先
    const preferredStaff = eligibleStaff.filter((member) => {
      const pref = preferences.find((p) => p.staffId === member.id && p.date.getDate() === day)
      return (
        pref &&
        pref.preference === "preferred" &&
        (icuAssignment ? member.yearsOfExperience <= icuStaffExperience : true)
      )
    })

    for (const member of preferredStaff) {
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

    if (assigned) continue

    // 上限に達していない人を優先
    for (const member of eligibleStaff) {
      // 経験年数条件を確認
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

    if (assigned) continue

    // どうしても割り当てられない場合は、上限+1まで許容するスタッフを探す
    for (const member of eligibleStaff.filter((m) => m.limitInterpretation === "flexible")) {
      // 経験年数条件を確認
      if (icuAssignment && member.yearsOfExperience > icuStaffExperience) continue

      // 上限+1まで許容
      if (
        shiftCounts[member.id].C > member.maxCShifts ||
        (shiftCounts[member.id].C === member.maxCShifts && shiftCounts[member.id].ICU > member.maxICUShifts)
      ) {
        continue
      }

      if (isAvailableForShift(member, day, assignments, staff, preferences)) {
        assignments.push({
          day,
          staffId: member.id,
          shiftType: "C",
          isSubstitute: shiftCounts[member.id].C >= member.maxCShifts,
        })
        shiftCounts[member.id].C++
        assigned = true
        break
      }
    }

    // それでも割り当てられない場合は、経験年数条件を緩和して再試行
    if (!assigned) {
      for (const member of eligibleStaff) {
        if (canAssignCShift(member, day, assignments, staff, shiftCounts, preferences, true)) {
          assignments.push({
            day,
            staffId: member.id,
            shiftType: "C",
            isSubstitute: shiftCounts[member.id].C >= member.maxCShifts,
          })
          shiftCounts[member.id].C++
          break
        }
      }
    }
  }
}

// Cシフトを割り当て可能かチェック
function canAssignCShift(
  member: Staff,
  day: number,
  assignments: ShiftAssignment[],
  staff: Staff[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[] = [],
  ignoreExperience = false,
): boolean {
  // 上限が0の場合は割り当てない
  if (member.maxCShifts === 0) return false

  // 上限に達している場合
  if (shiftCounts[member.id].C >= member.maxCShifts) {
    // 上限解釈が「flexible」で、ICU当直の上限を超えていない場合のみ許容
    if (member.limitInterpretation === "flexible" && shiftCounts[member.id].ICU <= member.maxICUShifts) {
      // OK
    } else {
      return false
    }
  }

  // 基本的な可用性チェック
  if (!isAvailableForShift(member, day, assignments, staff, preferences)) return false

  // 経験年数条件チェック（ignoreExperienceがtrueの場合はスキップ）
  if (!ignoreExperience) {
    const icuAssignment = assignments.find((a) => a.day === day && a.shiftType === "ICU")
    if (icuAssignment) {
      const icuStaffExperience = staff.find((s) => s.id === icuAssignment.staffId)?.yearsOfExperience || 0
      if (member.yearsOfExperience > icuStaffExperience) return false
    }
  }

  return true
}

// 上限に達していないスタッフがいる場合、再度割り当てを試みる
function ensureAllLimitsReached(
  daysInMonth: number,
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[],
): void {
  // 上限解釈が「strict」のスタッフを特定
  const strictStaff = staff.filter((member) => member.limitInterpretation === "strict")

  // ICU当直の上限に達していないスタッフを特定
  const staffWithUnreachedICULimits = strictStaff.filter(
    (member) => member.maxICUShifts > 0 && shiftCounts[member.id].ICU < member.maxICUShifts,
  )

  // C当直の上限に達していないスタッフを特定
  const staffWithUnreachedCLimits = strictStaff.filter(
    (member) => member.maxCShifts > 0 && shiftCounts[member.id].C < member.maxCShifts,
  )

  // ICU当直の上限に達していないスタッフがいる場合、他のスタッフのシフトを調整
  for (const member of staffWithUnreachedICULimits) {
    const remainingICUShifts = member.maxICUShifts - shiftCounts[member.id].ICU
    if (remainingICUShifts <= 0) continue

    // 上限を超えているスタッフのICU当直を探す
    const overLimitStaff = staff.filter(
      (s) => s.id !== member.id && shiftCounts[s.id].ICU > s.maxICUShifts && s.limitInterpretation !== "strict",
    )

    for (const overStaff of overLimitStaff) {
      // 上限を超えているスタッフのICU当直を見つける
      const overICUAssignments = assignments
        .filter((a) => a.staffId === overStaff.id && a.shiftType === "ICU" && !a.isManuallyAssigned)
        .sort((a, b) => a.day - b.day)

      // 上限を超えている分だけ、上限に達していないスタッフに割り当て直す
      for (let i = 0; i < Math.min(remainingICUShifts, overICUAssignments.length); i++) {
        const assignment = overICUAssignments[i]

        // 割り当て可能かチェック
        if (
          isAvailableForShift(
            member,
            assignment.day,
            assignments.filter((a) => a !== assignment),
            staff,
            preferences,
          )
        ) {
          // 割り当てを変更
          assignment.staffId = member.id
          assignment.isSubstitute = false

          // シフトカウントを更新
          shiftCounts[overStaff.id].ICU--
          shiftCounts[member.id].ICU++

          if (shiftCounts[member.id].ICU >= member.maxICUShifts) break
        }
      }
    }
  }

  // C当直の上限に達していないスタッフがいる場合、他のスタッフのシフトを調整
  for (const member of staffWithUnreachedCLimits) {
    const remainingCShifts = member.maxCShifts - shiftCounts[member.id].C
    if (remainingCShifts <= 0) continue

    // 上限を超えているスタッフのC当直を探す
    const overLimitStaff = staff.filter(
      (s) => s.id !== member.id && shiftCounts[s.id].C > s.maxCShifts && s.limitInterpretation !== "strict",
    )

    for (const overStaff of overLimitStaff) {
      // 上限を超えているスタッフのC当直を見つける
      const overCAssignments = assignments
        .filter((a) => a.staffId === overStaff.id && a.shiftType === "C" && !a.isManuallyAssigned)
        .sort((a, b) => a.day - b.day)

      // 上限を超えている分だけ、上限に達していないスタッフに割り当て直す
      for (let i = 0; i < Math.min(remainingCShifts, overCAssignments.length); i++) {
        const assignment = overCAssignments[i]

        // 割り当て可能かチェック
        if (
          isAvailableForShift(
            member,
            assignment.day,
            assignments.filter((a) => a !== assignment),
            staff,
            preferences,
          )
        ) {
          // 割り当てを変更
          assignment.staffId = member.id
          assignment.isSubstitute = false

          // シフトカウントを更新
          shiftCounts[overStaff.id].C--
          shiftCounts[member.id].C++

          if (shiftCounts[member.id].C >= member.maxCShifts) break
        }
      }
    }
  }
}

// 週末の当直回数を調整
function balanceWeekendShifts(
  daysInMonth: number,
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  year: number,
  month: number,
  holidays: number[],
  preferences: Preference[] = [],
): void {
  // 各スタッフの週末当直回数を計算
  const weekendShiftCounts: Record<string, number> = {}

  staff.forEach((member) => {
    weekendShiftCounts[member.id] = 0
  })

  // 週末（土日祝）の日を特定
  const weekendDays: number[] = []
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dayOfWeek = date.getDay()
    const isSaturday = dayOfWeek === 6
    const isSunday = dayOfWeek === 0
    const isHoliday = holidays.includes(day)

    if (isSaturday || isSunday || isHoliday) {
      weekendDays.push(day)
    }
  }

  // 各スタッフの週末当直回数をカウント
  for (const assignment of assignments) {
    if (weekendDays.includes(assignment.day) && (assignment.shiftType === "C" || assignment.shiftType === "ICU")) {
      weekendShiftCounts[assignment.staffId] = (weekendShiftCounts[assignment.staffId] || 0) + 1
    }
  }

  // 月6回以上当直するスタッフを特定
  const highVolumeStaff = staff.filter((member) => shiftCounts[member.id].C + shiftCounts[member.id].ICU >= 6)

  // 週末当直が2回以上のスタッフを特定（月6回以上当直するスタッフを除く）
  const staffWithExcessWeekends = staff
    .filter((member) => !highVolumeStaff.some((s) => s.id === member.id) && weekendShiftCounts[member.id] > 1)
    .sort((a, b) => weekendShiftCounts[b.id] - weekendShiftCounts[a.id])

  // 週末当直が0回のスタッフを特定
  const staffWithNoWeekends = staff
    .filter((member) => weekendShiftCounts[member.id] === 0)
    .sort((a, b) => {
      // 上限に余裕がある順
      const aMargin = a.maxCShifts + a.maxICUShifts - shiftCounts[a.id].C - shiftCounts[a.id].ICU
      const bMargin = b.maxCShifts + b.maxICUShifts - shiftCounts[b.id].C - shiftCounts[b.id].ICU
      return bMargin - aMargin
    })

  // 週末当直の再分配を試みる
  for (const excessStaff of staffWithExcessWeekends) {
    // 2回目以降の週末当直を見つける
    const weekendAssignments = assignments
      .filter(
        (a) =>
          a.staffId === excessStaff.id &&
          weekendDays.includes(a.day) &&
          (a.shiftType === "C" || a.shiftType === "ICU") &&
          !a.isManuallyAssigned,
      )
      .sort((a, b) => a.day - b.day)

    // 最初の週末当直は残し、2回目以降を再分配
    for (let i = 1; i < weekendAssignments.length; i++) {
      const assignment = weekendAssignments[i]

      // 週末当直が0回のスタッフに割り当て直す
      for (const noWeekendStaff of staffWithNoWeekends) {
        if (canReassignShift(assignment, noWeekendStaff, assignments, staff, shiftCounts, preferences)) {
          // 割り当てを変更
          assignment.staffId = noWeekendStaff.id

          // シフトカウントを更新
          if (assignment.shiftType === "C") {
            shiftCounts[excessStaff.id].C--
            shiftCounts[noWeekendStaff.id].C++
          } else {
            shiftCounts[excessStaff.id].ICU--
            shiftCounts[noWeekendStaff.id].ICU++
          }

          // 週末カウントを更新
          weekendShiftCounts[excessStaff.id]--
          weekendShiftCounts[noWeekendStaff.id]++

          // staffWithNoWeekendsから削除
          staffWithNoWeekends.splice(staffWithNoWeekends.indexOf(noWeekendStaff), 1)
          break
        }
      }
    }
  }
}

// シフトを再割り当て可能かチェック
function canReassignShift(
  assignment: ShiftAssignment,
  newStaff: Staff,
  assignments: ShiftAssignment[],
  staff: Staff[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[],
): boolean {
  // 上限チェック
  if (assignment.shiftType === "C") {
    if (newStaff.maxCShifts === 0) return false
    if (shiftCounts[newStaff.id].C >= newStaff.maxCShifts && newStaff.limitInterpretation !== "flexible") return false
    if (
      newStaff.limitInterpretation === "flexible" &&
      shiftCounts[newStaff.id].C >= newStaff.maxCShifts &&
      shiftCounts[newStaff.id].ICU > newStaff.maxICUShifts
    )
      return false
  } else if (assignment.shiftType === "ICU") {
    if (newStaff.maxICUShifts === 0) return false
    if (shiftCounts[newStaff.id].ICU >= newStaff.maxICUShifts && newStaff.limitInterpretation !== "flexible")
      return false
    if (
      newStaff.limitInterpretation === "flexible" &&
      shiftCounts[newStaff.id].ICU >= newStaff.maxICUShifts &&
      shiftCounts[newStaff.id].C > newStaff.maxCShifts
    )
      return false
  }

  // 基本的な可用性チェック
  const otherAssignments = assignments.filter((a) => a !== assignment)
  if (!isAvailableForShift(newStaff, assignment.day, otherAssignments, staff, preferences)) return false

  // 経験年数条件チェック
  if (assignment.shiftType === "C") {
    const icuAssignment = assignments.find((a) => a.day === assignment.day && a.shiftType === "ICU")
    if (icuAssignment) {
      const icuStaffExperience = staff.find((s) => s.id === icuAssignment.staffId)?.yearsOfExperience || 0
      if (newStaff.yearsOfExperience > icuStaffExperience) return false
    }
  } else if (assignment.shiftType === "ICU") {
    const cAssignment = assignments.find((a) => a.day === assignment.day && a.shiftType === "C")
    if (cAssignment) {
      const cStaffExperience = staff.find((s) => s.id === cAssignment.staffId)?.yearsOfExperience || 0
      if (newStaff.yearsOfExperience < cStaffExperience) return false
    }
  }

  return true
}

// 前半・後半のバランスを調整
function balanceFirstSecondHalf(
  daysInMonth: number,
  staff: Staff[],
  assignments: ShiftAssignment[],
  shiftCounts: Record<string, { C: number; ICU: number }>,
  preferences: Preference[] = [],
): void {
  const midPoint = Math.ceil(daysInMonth / 2)

  // 各スタッフの前半・後半のシフト回数を計算
  const firstHalfCounts: Record<string, { C: number; ICU: number }> = {}
  const secondHalfCounts: Record<string, { C: number; ICU: number }> = {}

  staff.forEach((member) => {
    firstHalfCounts[member.id] = { C: 0, ICU: 0 }
    secondHalfCounts[member.id] = { C: 0, ICU: 0 }
  })

  for (const assignment of assignments) {
    if (assignment.day < midPoint) {
      firstHalfCounts[assignment.staffId][assignment.shiftType]++
    } else {
      secondHalfCounts[assignment.staffId][assignment.shiftType]++
    }
  }

  // 前半・後半の差が大きいスタッフを特定
  const imbalancedStaff = staff
    .map((member) => {
      const firstHalfTotal = firstHalfCounts[member.id].C + firstHalfCounts[member.id].ICU
      const secondHalfTotal = secondHalfCounts[member.id].C + secondHalfCounts[member.id].ICU
      const difference = Math.abs(firstHalfTotal - secondHalfTotal)

      return {
        staff: member,
        difference,
        firstHalfTotal,
        secondHalfTotal,
      }
    })
    .filter((item) => item.difference >= 2)
    .sort((a, b) => b.difference - a.difference)

  // バランス調整を試みる
  for (const item of imbalancedStaff) {
    const member = item.staff

    // 前半が多い場合、前半のシフトを後半に移動
    if (item.firstHalfTotal > item.secondHalfTotal) {
      const firstHalfAssignments = assignments
        .filter(
          (a) =>
            a.staffId === member.id &&
            a.day < midPoint &&
            (a.shiftType === "C" || a.shiftType === "ICU") &&
            !a.isManuallyAssigned,
        )
        .sort((a, b) => b.day - a.day) // 前半の後ろから

      // 後半の少ないスタッフを探す
      const candidatesForSwap = staff
        .filter((s) => s.id !== member.id)
        .map((s) => {
          const firstHalfTotal = firstHalfCounts[s.id].C + firstHalfCounts[s.id].ICU
          const secondHalfTotal = secondHalfCounts[s.id].C + secondHalfCounts[s.id].ICU
          return {
            staff: s,
            difference: firstHalfTotal - secondHalfTotal,
          }
        })
        .filter((item) => item.difference < 0)
        .sort((a, b) => a.difference - b.difference)

      // 交換を試みる
      for (const assignment of firstHalfAssignments) {
        for (const candidate of candidatesForSwap) {
          // 後半のシフトを探す
          const secondHalfAssignments = assignments
            .filter(
              (a) =>
                a.staffId === candidate.staff.id &&
                a.day >= midPoint &&
                a.shiftType === assignment.shiftType &&
                !a.isManuallyAssigned,
            )
            .sort((a, b) => a.day - b.day) // 後半の前から

          for (const secondHalfAssignment of secondHalfAssignments) {
            // 交換可能かチェック
            if (canSwapShifts(assignment, secondHalfAssignment, staff, assignments, preferences)) {
              // スタッフIDを交換
              const tempId = assignment.staffId
              assignment.staffId = secondHalfAssignment.staffId
              secondHalfAssignment.staffId = tempId

              // カウントを更新
              if (assignment.shiftType === "C") {
                firstHalfCounts[member.id].C--
                firstHalfCounts[candidate.staff.id].C++
                secondHalfCounts[candidate.staff.id].C--
                secondHalfCounts[member.id].C++
              } else {
                firstHalfCounts[member.id].ICU--
                firstHalfCounts[candidate.staff.id].ICU++
                secondHalfCounts[candidate.staff.id].ICU--
                secondHalfCounts[member.id].ICU++
              }

              // 交換成功
              break
            }
          }
        }
      }
    }
    // 後半が多い場合、後半のシフトを前半に移動
    else {
      const secondHalfAssignments = assignments
        .filter(
          (a) =>
            a.staffId === member.id &&
            a.day >= midPoint &&
            (a.shiftType === "C" || a.shiftType === "ICU") &&
            !a.isManuallyAssigned,
        )
        .sort((a, b) => a.day - b.day) // 後半の前から

      // 前半の少ないスタッフを探す
      const candidatesForSwap = staff
        .filter((s) => s.id !== member.id)
        .map((s) => {
          const firstHalfTotal = firstHalfCounts[s.id].C + firstHalfCounts[s.id].ICU
          const secondHalfTotal = secondHalfCounts[s.id].C + secondHalfCounts[s.id].ICU
          return {
            staff: s,
            difference: secondHalfTotal - firstHalfTotal,
          }
        })
        .filter((item) => item.difference < 0)
        .sort((a, b) => a.difference - b.difference)

      // 交換を試みる
      for (const assignment of secondHalfAssignments) {
        for (const candidate of candidatesForSwap) {
          // 前半のシフトを探す
          const firstHalfAssignments = assignments
            .filter(
              (a) =>
                a.staffId === candidate.staff.id &&
                a.day < midPoint &&
                a.shiftType === assignment.shiftType &&
                !a.isManuallyAssigned,
            )
            .sort((a, b) => b.day - a.day) // 前半の後ろから

          for (const firstHalfAssignment of firstHalfAssignments) {
            // 交換可能かチェック
            if (canSwapShifts(firstHalfAssignment, assignment, staff, assignments, preferences)) {
              // スタッフIDを交換
              const tempId = assignment.staffId
              assignment.staffId = firstHalfAssignment.staffId
              firstHalfAssignment.staffId = tempId

              // カウントを更新
              if (assignment.shiftType === "C") {
                secondHalfCounts[member.id].C--
                secondHalfCounts[candidate.staff.id].C++
                firstHalfCounts[candidate.staff.id].C--
                firstHalfCounts[member.id].C++
              } else {
                secondHalfCounts[member.id].ICU--
                secondHalfCounts[candidate.staff.id].ICU++
                firstHalfCounts[candidate.staff.id].ICU--
                firstHalfCounts[member.id].ICU++
              }

              // 交換成功
              break
            }
          }
        }
      }
    }
  }
}

// シフトを交換可能かチェック
function canSwapShifts(
  assignment1: ShiftAssignment,
  assignment2: ShiftAssignment,
  staff: Staff[],
  assignments: ShiftAssignment[],
  preferences: Preference[] = [],
): boolean {
  const staff1 = staff.find((s) => s.id === assignment1.staffId)
  const staff2 = staff.find((s) => s.id === assignment2.staffId)

  if (!staff1 || !staff2) return false

  // 同じシフトタイプかチェック
  if (assignment1.shiftType !== assignment2.shiftType) return false

  // unavailableの希望をチェック
  const staff1UnavailableDay2 = preferences.find(
    (p) => p.staffId === staff1.id && p.date.getDate() === assignment2.day && p.preference === "unavailable"
  )
  const staff2UnavailableDay1 = preferences.find(
    (p) => p.staffId === staff2.id && p.date.getDate() === assignment1.day && p.preference === "unavailable"
  )
  
  if (staff1UnavailableDay2 || staff2UnavailableDay1) return false

  // 診療科の重複チェック
  const day1Assignments = assignments.filter((a) => a.day === assignment1.day && a !== assignment1)
  const day2Assignments = assignments.filter((a) => a.day === assignment2.day && a !== assignment2)

  // 診療科の重複チェック（day1に staff2 を割り当てた場合）
  const day1SameDepartment = day1Assignments.some((a) => {
    const assignedStaff = staff.find((s) => s.id === a.staffId)
    return assignedStaff && assignedStaff.department === staff2.department
  })

  // 診療科の重複チェック（day2に staff1 を割り当てた場合）
  const day2SameDepartment = day2Assignments.some((a) => {
    const assignedStaff = staff.find((s) => s.id === a.staffId)
    return assignedStaff && assignedStaff.department === staff1.department
  })

  if (day1SameDepartment || day2SameDepartment) return false

  // 経験年数条件チェック
  if (assignment1.shiftType === "C") {
    const day1ICU = assignments.find((a) => a.day === assignment1.day && a.shiftType === "ICU")
    const day2ICU = assignments.find((a) => a.day === assignment2.day && a.shiftType === "ICU")

    if (day1ICU) {
      const icuStaff = staff.find((s) => s.id === day1ICU.staffId)
      if (icuStaff && staff2.yearsOfExperience > icuStaff.yearsOfExperience) return false
    }

    if (day2ICU) {
      const icuStaff = staff.find((s) => s.id === day2ICU.staffId)
      if (icuStaff && staff1.yearsOfExperience > icuStaff.yearsOfExperience) return false
    }
  } else if (assignment1.shiftType === "ICU") {
    const day1C = assignments.find((a) => a.day === assignment1.day && a.shiftType === "C")
    const day2C = assignments.find((a) => a.day === assignment2.day && a.shiftType === "C")

    if (day1C) {
      const cStaff = staff.find((s) => s.id === day1C.staffId)
      if (cStaff && staff2.yearsOfExperience < cStaff.yearsOfExperience) return false
    }

    if (day2C) {
      const cStaff = staff.find((s) => s.id === day2C.staffId)
      if (cStaff && staff1.yearsOfExperience < cStaff.yearsOfExperience) return false
    }
  }

  // 当直間隔チェック
  const tempAssignments = [...assignments]
  const idx1 = tempAssignments.indexOf(assignment1)
  const idx2 = tempAssignments.indexOf(assignment2)

  // 一時的に交換
  tempAssignments[idx1] = { ...assignment1, staffId: assignment2.staffId }
  tempAssignments[idx2] = { ...assignment2, staffId: assignment1.staffId }

  // staff1の当直間隔チェック
  const staff1Assignments = tempAssignments
    .filter((a) => a.staffId === staff1.id && (a.shiftType === "C" || a.shiftType === "ICU"))
    .sort((a, b) => a.day - b.day)

  for (let i = 1; i < staff1Assignments.length; i++) {
    if (staff1Assignments[i].day - staff1Assignments[i - 1].day <= 3) return false
  }

  // staff2の当直間隔チェック
  const staff2Assignments = tempAssignments
    .filter((a) => a.staffId === staff2.id && (a.shiftType === "C" || a.shiftType === "ICU"))
    .sort((a, b) => a.day - b.day)

  for (let i = 1; i < staff2Assignments.length; i++) {
    if (staff2Assignments[i].day - staff2Assignments[i - 1].day <= 3) return false
  }

  return true
}
