"use client"

import { useState } from "react"
import type { Staff, Schedule, Preference } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


interface GeneratedScheduleProps {
  schedule: Schedule | null
  staff: Staff[]
  preferences: Preference[]
  daysInMonth: number
  holidays: number[]
  onScheduleUpdate: (schedule: Schedule) => void
}

export default function GeneratedSchedule({
  schedule,
  staff,
  preferences,
  daysInMonth,
  holidays,
  onScheduleUpdate,
}: GeneratedScheduleProps) {
  const [isManualAssignDialogOpen, setIsManualAssignDialogOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedShiftType, setSelectedShiftType] = useState<"C" | "ICU" | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar")
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    day: number
    shiftType: "C" | "ICU"
    staffId?: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    day: 0,
    shiftType: "C",
  })

  if (!schedule) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-muted-foreground">
          スケジュールがまだ生成されていません。「スケジュール自動生成」ボタンをクリックしてください。
        </p>
      </div>
    )
  }

  const getStaffName = (staffId: string): string => {
    const member = staff.find((s) => s.id === staffId)
    return member ? member.name : "不明"
  }

  const getStaffDepartment = (staffId: string): string => {
    const member = staff.find((s) => s.id === staffId)
    return member ? member.department : ""
  }

  const getStaffExperience = (staffId: string): number => {
    const member = staff.find((s) => s.id === staffId)
    return member ? member.yearsOfExperience : 0
  }

  const getPreference = (staffId: string, day: number): string => {
    const date = new Date(schedule.year, schedule.month, day)
    const pref = preferences.find((p) => p.staffId === staffId && p.date.getDate() === day)
    return pref ? pref.preference : "neutral"
  }

  // カレンダービューのコンポーネント
  const CalendarView = () => {
    const firstDay = new Date(schedule.year, schedule.month, 1).getDay()
    const weeks = Math.ceil((daysInMonth + firstDay) / 7)
    
    const dayOfWeekHeaders = ["日", "月", "火", "水", "木", "金", "土"]
    
    return (
      <div className="w-full max-w-7xl mx-auto">
        <div className="space-y-2">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 bg-gray-100 border rounded-t-lg">
            {dayOfWeekHeaders.map((day, index) => (
              <div
                key={day}
                className={`p-2 text-center font-semibold text-base ${
                  index === 0 ? "text-red-500" : index === 6 ? "text-blue-500" : ""
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* カレンダー本体 */}
          {Array.from({ length: weeks }, (_, weekIndex) => {
            const startDay = weekIndex * 7 - firstDay + 1
            const endDay = Math.min(startDay + 6, daysInMonth)
            
            return (
              <div key={weekIndex} className="border-l border-r border-b last:rounded-b-lg overflow-hidden">
              
              {/* 日付行 */}
              <div className="grid grid-cols-7">
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const day = startDay + dayIndex
                  const dayOfWeek = (weekIndex * 7 + dayIndex) % 7
                  
                  if (weekIndex === 0 && dayIndex < firstDay) {
                    return <div key={dayIndex} className="p-4 bg-gray-50"></div>
                  }
                  
                  if (day > daysInMonth) {
                    return <div key={dayIndex} className="p-4 bg-gray-50"></div>
                  }
                  
                  const isHoliday = holidays.includes(day)
                  const isSunday = dayOfWeek === 0
                  const isSaturday = dayOfWeek === 6
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`border-r last:border-r-0 min-h-[120px] ${
                        isSunday || isHoliday ? "bg-red-50" : isSaturday ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className={`p-1 text-center font-semibold text-sm border-b ${
                        isSunday || isHoliday ? "text-red-500" : isSaturday ? "text-blue-500" : ""
                      }`}>
                        {day}日{isHoliday && "祝"}
                      </div>
                      
                      {/* C当直 */}
                      <div className="p-1 border-b min-h-[50px]">
                        <div className="text-xs font-medium text-gray-600">C</div>
                        {(() => {
                          const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "C")
                          if (assignment) {
                            const staffId = assignment.staffId
                            const preference = getPreference(staffId, day)
                            const isSubstitute = assignment.isSubstitute
                            const isManuallyAssigned = assignment.isManuallyAssigned
                            const experience = getStaffExperience(staffId)
                            
                            let preferenceIndicator = ""
                            if (preference === "required") preferenceIndicator = "◎"
                            else if (preference === "preferred") preferenceIndicator = "○"
                            else if (preference === "unavailable") preferenceIndicator = "×"
                            
                            return (
                              <div
                                className={`text-xs ${isSubstitute ? "text-red-500" : ""} cursor-pointer hover:bg-gray-100 rounded`}
                                onClick={() => handleManualAssign(day, "C")}
                                onContextMenu={(e) => handleContextMenu(e, day, "C", staffId)}
                              >
                                <div className="font-medium truncate">{getStaffName(staffId)}</div>
                                <div className="text-[10px] text-gray-500">{experience}年 {preferenceIndicator}</div>
                                {isManuallyAssigned && <span className="text-[10px] text-purple-500">*</span>}
                                {isSubstitute && <span className="text-[10px] text-red-500">+</span>}
                              </div>
                            )
                          }
                          return (
                            <div
                              className="text-xs text-gray-300 cursor-pointer hover:bg-gray-100 rounded"
                              onClick={() => handleManualAssign(day, "C")}
                              onContextMenu={(e) => handleContextMenu(e, day, "C")}
                            >
                              -
                            </div>
                          )
                        })()}
                      </div>
                      
                      {/* ICU当直 */}
                      <div className="p-1 min-h-[50px]">
                        <div className="text-xs font-medium text-gray-600">ICU</div>
                        {(() => {
                          const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "ICU")
                          if (assignment) {
                            const staffId = assignment.staffId
                            const preference = getPreference(staffId, day)
                            const isSubstitute = assignment.isSubstitute
                            const isManuallyAssigned = assignment.isManuallyAssigned
                            const experience = getStaffExperience(staffId)
                            
                            let preferenceIndicator = ""
                            if (preference === "required") preferenceIndicator = "◎"
                            else if (preference === "preferred") preferenceIndicator = "○"
                            else if (preference === "unavailable") preferenceIndicator = "×"
                            
                            return (
                              <div
                                className={`text-xs ${isSubstitute ? "text-red-500" : ""} cursor-pointer hover:bg-gray-100 rounded`}
                                onClick={() => handleManualAssign(day, "ICU")}
                                onContextMenu={(e) => handleContextMenu(e, day, "ICU", staffId)}
                              >
                                <div className="font-medium truncate">{getStaffName(staffId)}</div>
                                <div className="text-[10px] text-gray-500">{experience}年 {preferenceIndicator}</div>
                                {isManuallyAssigned && <span className="text-[10px] text-purple-500">*</span>}
                                {isSubstitute && <span className="text-[10px] text-red-500">+</span>}
                              </div>
                            )
                          }
                          return (
                            <div
                              className="text-xs text-gray-300 cursor-pointer hover:bg-gray-100 rounded"
                              onClick={() => handleManualAssign(day, "ICU")}
                              onContextMenu={(e) => handleContextMenu(e, day, "ICU")}
                            >
                              -
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    )
  }

  // テーブルビューのコンポーネント（横一列表示）
  const TableView = () => {
    // 日付ヘッダーを生成
    const dayHeaders = []
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(schedule.year, schedule.month, day)
      const dayOfWeek = date.getDay()
      const isSunday = dayOfWeek === 0
      const isHoliday = holidays.includes(day)
      const isSaturday = dayOfWeek === 6

      dayHeaders.push(
        <TableHead
          key={day}
          className={`text-center p-1 min-w-[60px] ${isSunday || isHoliday ? "text-red-500" : ""} ${
            isSaturday ? "text-blue-500" : ""
          }`}
        >
          <div className="text-base font-medium">{day}</div>
          <div className="text-sm">
            {["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]}
            {isHoliday ? "祝" : ""}
          </div>
        </TableHead>,
      )
    }

    return (
      <div className="overflow-x-auto">
        <Table className="w-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-white z-10 min-w-[100px] text-lg">日付</TableHead>
              {dayHeaders}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="sticky left-0 bg-white z-10 font-medium text-lg">C当直</TableCell>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "C")

                if (assignment) {
                  const staffId = assignment.staffId
                  const preference = getPreference(staffId, day)
                  const isSubstitute = assignment.isSubstitute
                  const isManuallyAssigned = assignment.isManuallyAssigned
                  const experience = getStaffExperience(staffId)

                  let preferenceIndicator = ""
                  if (preference === "required") preferenceIndicator = "◎"
                  else if (preference === "preferred") preferenceIndicator = "○"
                  else if (preference === "unavailable") preferenceIndicator = "×"

                  return (
                    <TableCell key={day} className="p-2 text-center relative group">
                      <div
                        className={`text-base ${isSubstitute ? "text-red-500" : ""} cursor-pointer`}
                        onClick={() => handleManualAssign(day, "C")}
                        onContextMenu={(e) => handleContextMenu(e, day, "C", staffId)}
                      >
                        <div className="font-medium">{getStaffName(staffId)}</div>
                        <div className="text-sm text-gray-500">{experience}年</div>
                        {preferenceIndicator && <span className="text-sm">{preferenceIndicator}</span>}
                        {isManuallyAssigned && <span className="text-purple-500">*</span>}
                        {isSubstitute && <span className="text-sm text-red-500">+</span>}
                      </div>
                      <div 
                        className="absolute inset-0 bg-blue-100 opacity-0 group-hover:opacity-20 transition-opacity duration-200 cursor-pointer"
                        onClick={() => handleManualAssign(day, "C")}
                        onContextMenu={(e) => handleContextMenu(e, day, "C", staffId)}
                      ></div>
                    </TableCell>
                  )
                }
                return (
                  <TableCell key={day} className="p-2 text-center relative group">
                    <span className="text-base text-gray-300">-</span>
                    <div
                      className="absolute inset-0 bg-blue-100 opacity-0 group-hover:opacity-20 cursor-pointer"
                      onClick={() => handleManualAssign(day, "C")}
                      onContextMenu={(e) => handleContextMenu(e, day, "C")}
                    ></div>
                  </TableCell>
                )
              })}
            </TableRow>
            <TableRow>
              <TableCell className="sticky left-0 bg-white z-10 font-medium text-lg">ICU当直</TableCell>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "ICU")

                if (assignment) {
                  const staffId = assignment.staffId
                  const preference = getPreference(staffId, day)
                  const isSubstitute = assignment.isSubstitute
                  const isManuallyAssigned = assignment.isManuallyAssigned
                  const experience = getStaffExperience(staffId)

                  let preferenceIndicator = ""
                  if (preference === "required") preferenceIndicator = "◎"
                  else if (preference === "preferred") preferenceIndicator = "○"
                  else if (preference === "unavailable") preferenceIndicator = "×"

                  return (
                    <TableCell key={day} className="p-2 text-center relative group">
                      <div
                        className={`text-base ${isSubstitute ? "text-red-500" : ""} cursor-pointer`}
                        onClick={() => handleManualAssign(day, "ICU")}
                        onContextMenu={(e) => handleContextMenu(e, day, "ICU", staffId)}
                      >
                        <div className="font-medium">{getStaffName(staffId)}</div>
                        <div className="text-sm text-gray-500">{experience}年</div>
                        {preferenceIndicator && <span className="text-sm">{preferenceIndicator}</span>}
                        {isManuallyAssigned && <span className="text-purple-500">*</span>}
                        {isSubstitute && <span className="text-sm text-red-500">+</span>}
                      </div>
                      <div 
                        className="absolute inset-0 bg-blue-100 opacity-0 group-hover:opacity-20 cursor-pointer"
                        onClick={() => handleManualAssign(day, "ICU")}
                        onContextMenu={(e) => handleContextMenu(e, day, "ICU", staffId)}
                      ></div>
                    </TableCell>
                  )
                }
                return (
                  <TableCell key={day} className="p-2 text-center relative group">
                    <span className="text-base text-gray-300">-</span>
                    <div
                      className="absolute inset-0 bg-blue-100 opacity-0 group-hover:opacity-20 cursor-pointer"
                      onClick={() => handleManualAssign(day, "ICU")}
                      onContextMenu={(e) => handleContextMenu(e, day, "ICU")}
                    ></div>
                  </TableCell>
                )
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  const handleManualAssign = (day: number, shiftType: "C" | "ICU") => {
    setSelectedDay(day)
    setSelectedShiftType(shiftType)
    
    // 既存の割り当てがある場合はそのスタッフIDを設定
    const existingAssignment = schedule.assignments.find((a) => a.day === day && a.shiftType === shiftType)
    setSelectedStaffId(existingAssignment ? existingAssignment.staffId : null)
    
    setIsManualAssignDialogOpen(true)
    setContextMenu({ ...contextMenu, visible: false })
  }

  const handleContextMenu = (e: React.MouseEvent, day: number, shiftType: "C" | "ICU", staffId?: string) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      day,
      shiftType,
      staffId,
    })
  }

  const handleDeleteAssignment = () => {
    if (!contextMenu.staffId) return

    const updatedAssignments = schedule.assignments.filter(
      (a) => !(a.day === contextMenu.day && a.shiftType === contextMenu.shiftType && a.staffId === contextMenu.staffId),
    )

    const updatedSchedule = {
      ...schedule,
      assignments: updatedAssignments,
    }

    onScheduleUpdate(updatedSchedule)
    setContextMenu({ ...contextMenu, visible: false })
  }

  const handleManualAssignConfirm = () => {
    if (!selectedDay || !selectedShiftType) return

    // 既存の割り当てを削除
    let updatedAssignments = schedule.assignments.filter(
      (a) => !(a.day === selectedDay && a.shiftType === selectedShiftType),
    )

    // 新しい割り当てを追加（"__delete__"の場合は削除のみ）
    if (selectedStaffId && selectedStaffId !== "__delete__") {
      updatedAssignments.push({
        day: selectedDay,
        staffId: selectedStaffId,
        shiftType: selectedShiftType,
        isManuallyAssigned: true,
      })
    }

    // スケジュールを更新
    const updatedSchedule = {
      ...schedule,
      assignments: updatedAssignments,
    }

    onScheduleUpdate(updatedSchedule)
    setIsManualAssignDialogOpen(false)
  }



  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold">生成されたスケジュール</h2>

      <Tabs defaultValue="schedule">
        <TabsList className="h-12">
          <TabsTrigger value="schedule" className="text-lg px-6">スケジュール</TabsTrigger>
          <TabsTrigger value="summary" className="text-lg px-6">サマリー</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <div className="mb-4">
            <Button
              onClick={() => setViewMode(viewMode === "calendar" ? "table" : "calendar")}
              variant="outline"
              className="text-base"
            >
              {viewMode === "calendar" ? "横一列表示に切り替え" : "カレンダー表示に切り替え"}
            </Button>
          </div>
          <div className="w-full">
            {viewMode === "calendar" ? <CalendarView /> : <TableView />}
          </div>
          <div className="mt-4 text-base space-y-2">
            <p>
              <span className="text-purple-500">*</span> は手動で割り当てられたシフトを示します
            </p>
            <p>
              <span className="text-red-500">+</span> は上限を超えて割り当てられたシフトを示します
            </p>
            <div className="bg-blue-50 p-4 rounded border border-blue-200">
              <p className="font-semibold text-blue-800 mb-2 text-lg">手動でのスケジュール変更方法：</p>
              <ul className="space-y-2 text-blue-700">
                <li>• <strong>左クリック</strong>：スタッフの割り当て・変更ダイアログを開く</li>
                <li>• <strong>右クリック</strong>：コンテキストメニューで素早く変更・削除</li>
                <li>• ダイアログで「割り当てを削除」を選択すると、そのシフトから割り当てを削除できます</li>
              </ul>
            </div>
          </div>
        </TabsContent>


        <TabsContent value="summary">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-lg p-4">名前</TableHead>
                  <TableHead className="text-lg p-4">診療科</TableHead>
                  <TableHead className="text-lg p-4">経験年数</TableHead>
                  <TableHead className="text-lg p-4">上限解釈</TableHead>
                  <TableHead className="text-lg p-4">C当直</TableHead>
                  <TableHead className="text-lg p-4">ICU当直</TableHead>
                  <TableHead className="text-lg p-4">当直日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff
                  .filter((s) => s.name)
                  .sort((a, b) => b.yearsOfExperience - a.yearsOfExperience) // 経験年数順にソート
                  .map((member) => {
                    const cShifts = schedule.assignments.filter((a) => a.staffId === member.id && a.shiftType === "C")
                    const icuShifts = schedule.assignments.filter(
                      (a) => a.staffId === member.id && a.shiftType === "ICU",
                    )

                    const cSubstitutes = cShifts.filter((a) => a.isSubstitute)
                    const icuSubstitutes = icuShifts.filter((a) => a.isSubstitute)

                    const hasSubstitutes = cSubstitutes.length > 0 || icuSubstitutes.length > 0

                    const allShiftDays = [...cShifts, ...icuShifts]
                      .sort((a, b) => a.day - b.day)
                      .map((a) => {
                        const isSubstitute = a.isSubstitute
                        const isManuallyAssigned = a.isManuallyAssigned
                        return `${a.day}日(${a.shiftType})${isSubstitute ? "+" : ""}${isManuallyAssigned ? "*" : ""}`
                      })

                    // 上限達成率を計算
                    const cPercentage = member.maxCShifts > 0 ? (cShifts.length / member.maxCShifts) * 100 : 100
                    const icuPercentage = member.maxICUShifts > 0 ? (icuShifts.length / member.maxICUShifts) * 100 : 100

                    // 上限解釈の表示
                    let limitInterpretationDisplay = "-"
                    if (member.limitInterpretation === "strict") limitInterpretationDisplay = "○"
                    else if (member.limitInterpretation === "flexible") limitInterpretationDisplay = "△"

                    // 週末当直回数を計算
                    const weekendShifts = [...cShifts, ...icuShifts].filter((shift) => {
                      const date = new Date(schedule.year, schedule.month, shift.day)
                      const dayOfWeek = date.getDay()
                      return dayOfWeek === 0 || dayOfWeek === 6 || holidays.includes(shift.day)
                    })

                    // 前半・後半の当直回数を計算
                    const midPoint = Math.ceil(daysInMonth / 2)
                    const firstHalfShifts = [...cShifts, ...icuShifts].filter((shift) => shift.day < midPoint)
                    const secondHalfShifts = [...cShifts, ...icuShifts].filter((shift) => shift.day >= midPoint)

                    return (
                      <TableRow key={member.id} className={hasSubstitutes ? "bg-red-50" : ""}>
                        <TableCell>{member.name}</TableCell>
                        <TableCell>{member.department}</TableCell>
                        <TableCell>{member.yearsOfExperience}年</TableCell>
                        <TableCell>{limitInterpretationDisplay}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                member.limitInterpretation === "strict" && cShifts.length < member.maxCShifts
                                  ? "text-orange-500 font-bold"
                                  : cShifts.length > member.maxCShifts
                                    ? "text-red-500 font-bold"
                                    : ""
                              }
                            >
                              {cShifts.length}/{member.maxCShifts}
                            </span>
                            <Progress
                              value={cPercentage > 100 ? 100 : cPercentage}
                              className={`h-2 w-16 ${cPercentage > 100 ? "bg-red-200" : ""}`}
                            />
                            {cSubstitutes.length > 0 && <span className="text-red-500">+</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                member.limitInterpretation === "strict" && icuShifts.length < member.maxICUShifts
                                  ? "text-orange-500 font-bold"
                                  : icuShifts.length > member.maxICUShifts
                                    ? "text-red-500 font-bold"
                                    : ""
                              }
                            >
                              {icuShifts.length}/{member.maxICUShifts}
                            </span>
                            <Progress
                              value={icuPercentage > 100 ? 100 : icuPercentage}
                              className={`h-2 w-16 ${icuPercentage > 100 ? "bg-red-200" : ""}`}
                            />
                            {icuSubstitutes.length > 0 && <span className="text-red-500">+</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="text-base">{allShiftDays.join(", ")}</div>
                            <div className="text-sm mt-2">
                              <span className="text-gray-500">週末: {weekendShifts.length}回</span>
                              <span className="text-gray-500 ml-2">
                                前/後: {firstHalfShifts.length}/{secondHalfShifts.length}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
            <div className="mt-6 text-base space-y-2">
              <p>
                <span className="text-purple-500">*</span> は手動で割り当てられたシフトを示します
              </p>
              <p>
                <span className="text-red-500">+</span> は上限を超えて割り当てられたシフトを示します
              </p>
              <p>
                <span className="text-orange-500">太字の数字</span> は上限に達していないシフトを示します
              </p>
              <p>
                <span className="text-red-500">赤字の数字</span> は上限を超えたシフトを示します
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* 手動割り当てダイアログ */}
      <Dialog open={isManualAssignDialogOpen} onOpenChange={setIsManualAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>シフトの手動割り当て</DialogTitle>
            <DialogDescription>
              {selectedDay}日の{selectedShiftType === "C" ? "C当直" : "ICU当直"}を割り当てるスタッフを選択してください。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedStaffId || "__delete__"} onValueChange={setSelectedStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="スタッフを選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__delete__">割り当てを削除</SelectItem>
                {staff
                  .filter((s) => s.name)
                  .filter((s) => {
                    if (!selectedDay || !selectedShiftType) return false
                    
                    // 1. その日に既にシフトが割り当てられているかチェック
                    const hasShiftOnDay = schedule.assignments.some(
                      (a) => a.day === selectedDay && a.staffId === s.id
                    )
                    if (hasShiftOnDay) return false
                    
                    // 2. unavailable（×）の希望がある場合は除外
                    const pref = preferences.find((p) => p.staffId === s.id && p.date.getDate() === selectedDay)
                    if (pref && pref.preference === "unavailable") return false
                    
                    return true
                  })
                  .map((s) => {
                    // 現在のシフト数を計算
                    const currentShifts = schedule.assignments.filter(
                      (a) => a.staffId === s.id && a.shiftType === selectedShiftType
                    ).length
                    const maxShifts = selectedShiftType === "C" ? s.maxCShifts : s.maxICUShifts
                    const isOverLimit = currentShifts >= maxShifts
                    
                    // 希望を取得
                    const pref = preferences.find((p) => p.staffId === s.id && p.date.getDate() === selectedDay)
                    let preferenceText = ""
                    if (pref) {
                      if (pref.preference === "required") preferenceText = " ◎"
                      else if (pref.preference === "preferred") preferenceText = " ○"
                    }
                    
                    return (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.department}, {s.yearsOfExperience}年, {currentShifts}/{maxShifts}回{preferenceText})
                        {isOverLimit && " [上限超過]"}
                      </SelectItem>
                    )
                  })}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualAssignDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleManualAssignConfirm}>
              {selectedStaffId === "__delete__" ? "削除" : selectedStaffId ? "割り当て" : "削除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 右クリックメニュー */}
      {contextMenu.visible && (
        <div
          className="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseLeave={() => setContextMenu({ ...contextMenu, visible: false })}
        >
          <button
            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100"
            onClick={() => handleManualAssign(contextMenu.day, contextMenu.shiftType)}
          >
            スタッフを変更
          </button>
          {contextMenu.staffId && (
            <button
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
              onClick={handleDeleteAssignment}
            >
              割り当てを削除
            </button>
          )}
        </div>
      )}

      {/* 画面クリックで右クリックメニューを閉じる */}
      {contextMenu.visible && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu({ ...contextMenu, visible: false })}
        />
      )}
    </div>
  )
}
