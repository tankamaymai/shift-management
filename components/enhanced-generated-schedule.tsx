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

interface EnhancedGeneratedScheduleProps {
  schedule: Schedule | null
  staff: Staff[]
  preferences: Preference[]
  daysInMonth: number
  holidays: number[]
  onScheduleUpdate: (schedule: Schedule) => void
}

export default function EnhancedGeneratedSchedule({
  schedule,
  staff,
  preferences,
  daysInMonth,
  holidays,
  onScheduleUpdate,
}: EnhancedGeneratedScheduleProps) {
  const [isManualAssignDialogOpen, setIsManualAssignDialogOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [selectedShiftType, setSelectedShiftType] = useState<"C" | "ICU" | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
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
  const [draggedItem, setDraggedItem] = useState<{
    staffId: string
    day: number
    shiftType: "C" | "ICU"
  } | null>(null)
  const [dragOverCell, setDragOverCell] = useState<{
    day: number
    shiftType: "C" | "ICU"
  } | null>(null)

  if (!schedule) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">
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

  // ドラッグ&ドロップのハンドラー
  const handleDragStart = (e: React.DragEvent, staffId: string, day: number, shiftType: "C" | "ICU") => {
    setDraggedItem({ staffId, day, shiftType })
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, day: number, shiftType: "C" | "ICU") => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverCell({ day, shiftType })
  }

  const handleDragLeave = () => {
    setDragOverCell(null)
  }

  const handleDrop = (e: React.DragEvent, targetDay: number, targetShiftType: "C" | "ICU") => {
    e.preventDefault()
    
    if (!draggedItem) return

    // 同じ場所にドロップした場合は何もしない
    if (draggedItem.day === targetDay && draggedItem.shiftType === targetShiftType) {
      setDraggedItem(null)
      setDragOverCell(null)
      return
    }

    // 既存の割り当てを削除（ドラッグ元とドロップ先）
    let updatedAssignments = schedule.assignments.filter(
      (a) => !(
        (a.day === draggedItem.day && a.shiftType === draggedItem.shiftType && a.staffId === draggedItem.staffId) ||
        (a.day === targetDay && a.shiftType === targetShiftType)
      )
    )

    // 新しい割り当てを追加
    updatedAssignments.push({
      day: targetDay,
      staffId: draggedItem.staffId,
      shiftType: targetShiftType,
      isManuallyAssigned: true,
    })

    // スケジュールを更新
    const updatedSchedule = {
      ...schedule,
      assignments: updatedAssignments,
    }

    onScheduleUpdate(updatedSchedule)
    setDraggedItem(null)
    setDragOverCell(null)
  }

  // 日付ヘッダーを生成（コンパクトに）
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
        className={`text-center p-0 w-8 ${isSunday || isHoliday ? "text-red-500" : ""} ${
          isSaturday ? "text-blue-500" : ""
        }`}
      >
        <div className="text-xs">{day}</div>
        <div className="text-[0.6rem]">
          {["日", "月", "火", "水", "木", "金", "土"][dayOfWeek]}
          {isHoliday ? "祝" : ""}
        </div>
      </TableHead>,
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">生成されたスケジュール</h2>
      <div className="bg-green-50 p-3 rounded border border-green-200">
        <p className="font-semibold text-green-800 mb-1">✅ 改善されたスケジュール生成</p>
        <ul className="space-y-1 text-green-700 text-sm">
          <li>• 日勤シフトを削除し、CとICU当直のみに集中</li>
          <li>• 空白セルを強制的に埋める機能を追加（24日、27日、28日などの空白を解消）</li>
          <li>• より確実なスケジュール生成を実現</li>
        </ul>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">スケジュール</TabsTrigger>
          <TabsTrigger value="drag-drop">ドラッグ&ドロップ</TabsTrigger>
          <TabsTrigger value="summary">サマリー</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <div className="overflow-x-auto">
            <Table className="w-auto">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-white z-10 w-16">日付</TableHead>
                  {dayHeaders}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="sticky left-0 bg-white z-10 font-medium">C当直</TableCell>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "C")

                    if (assignment) {
                      const staffId = assignment.staffId
                      const preference = getPreference(staffId, day)
                      const experience = getStaffExperience(staffId)
                      const isManuallyAssigned = assignment.isManuallyAssigned
                      const isSubstitute = assignment.isSubstitute

                      let preferenceIndicator = ""
                      if (preference === "required") preferenceIndicator = "◎"
                      else if (preference === "preferred") preferenceIndicator = "○"
                      else if (preference === "unavailable") preferenceIndicator = "×"

                      return (
                        <TableCell key={day} className="p-0 text-center relative group">
                          <div 
                            className={`text-[0.6rem] ${isSubstitute ? "text-red-500" : ""} cursor-pointer`}
                            onClick={() => handleManualAssign(day, "C")}
                            onContextMenu={(e) => handleContextMenu(e, day, "C", staffId)}
                          >
                            <div className="font-medium">{getStaffName(staffId)}</div>
                            <div className="text-[0.5rem] text-gray-500">{experience}年</div>
                            {preferenceIndicator && <span className="text-[0.5rem]">{preferenceIndicator}</span>}
                            {isManuallyAssigned && <span className="text-purple-500">*</span>}
                            {isSubstitute && <span className="text-[0.5rem] text-red-500">+</span>}
                          </div>
                          <div 
                            className="absolute inset-0 bg-blue-100 opacity-0 group-hover:opacity-20 cursor-pointer"
                            onClick={() => handleManualAssign(day, "C")}
                            onContextMenu={(e) => handleContextMenu(e, day, "C", staffId)}
                          ></div>
                        </TableCell>
                      )
                    }
                    return (
                      <TableCell key={day} className="p-0 text-center relative group">
                        <span className="text-[0.6rem] text-gray-300">-</span>
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
                  <TableCell className="sticky left-0 bg-white z-10 font-medium">ICU当直</TableCell>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "ICU")

                    if (assignment) {
                      const staffId = assignment.staffId
                      const preference = getPreference(staffId, day)
                      const experience = getStaffExperience(staffId)
                      const isManuallyAssigned = assignment.isManuallyAssigned
                      const isSubstitute = assignment.isSubstitute

                      let preferenceIndicator = ""
                      if (preference === "required") preferenceIndicator = "◎"
                      else if (preference === "preferred") preferenceIndicator = "○"
                      else if (preference === "unavailable") preferenceIndicator = "×"

                      return (
                        <TableCell key={day} className="p-0 text-center relative group">
                          <div 
                            className={`text-[0.6rem] ${isSubstitute ? "text-red-500" : ""} cursor-pointer`}
                            onClick={() => handleManualAssign(day, "ICU")}
                            onContextMenu={(e) => handleContextMenu(e, day, "ICU", staffId)}
                          >
                            <div className="font-medium">{getStaffName(staffId)}</div>
                            <div className="text-[0.5rem] text-gray-500">{experience}年</div>
                            {preferenceIndicator && <span className="text-[0.5rem]">{preferenceIndicator}</span>}
                            {isManuallyAssigned && <span className="text-purple-500">*</span>}
                            {isSubstitute && <span className="text-[0.5rem] text-red-500">+</span>}
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
                      <TableCell key={day} className="p-0 text-center relative group">
                        <span className="text-[0.6rem] text-gray-300">-</span>
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
          <div className="mt-2 text-xs space-y-1">
            <p>
              <span className="text-purple-500">*</span> は手動で割り当てられたシフトを示します
            </p>
            <p>
              <span className="text-red-500">+</span> は上限を超えて割り当てられたシフトを示します
            </p>
            <div className="bg-blue-50 p-2 rounded border border-blue-200">
              <p className="font-semibold text-blue-800 mb-1">手動でのスケジュール変更方法：</p>
              <ul className="space-y-1 text-blue-700">
                <li>• <strong>左クリック</strong>：スタッフの割り当て・変更ダイアログを開く</li>
                <li>• <strong>右クリック</strong>：コンテキストメニューで素早く変更・削除</li>
                <li>• ダイアログで「割り当てを削除」を選択すると、そのシフトから割り当てを削除できます</li>
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="drag-drop">
          <div className="space-y-4">
            <div className="bg-blue-50 p-3 rounded border border-blue-200">
              <p className="font-semibold text-blue-800 mb-1">ドラッグ&ドロップでのスケジュール変更方法：</p>
              <ul className="space-y-1 text-blue-700 text-sm">
                <li>• スタッフ名をドラッグして、別の日または別のシフトタイプにドロップします</li>
                <li>• 既存の割り当てがある場所にドロップすると、自動的に入れ替わります</li>
                <li>• 日勤は廃止されました - CとICU当直のみの管理となります</li>
              </ul>
            </div>
            
            <div className="overflow-x-auto">
              <Table className="w-auto">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 w-16">日付</TableHead>
                    {dayHeaders}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium">C当直</TableCell>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "C")

                      return (
                        <TableCell 
                          key={day} 
                          className={`p-1 text-center relative ${
                            dragOverCell?.day === day && dragOverCell?.shiftType === "C" 
                              ? "bg-blue-50 border-2 border-blue-300" 
                              : ""
                          }`}
                          onDragOver={(e) => handleDragOver(e, day, "C")}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, day, "C")}
                        >
                          {assignment ? (
                            <div 
                              className={`text-[0.65rem] p-1 rounded cursor-move bg-blue-100 hover:bg-blue-200 ${assignment.isSubstitute ? "text-red-500" : ""}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, assignment.staffId, day, "C")}
                            >
                              {getStaffName(assignment.staffId)}
                              {assignment.isManuallyAssigned && <span className="text-purple-500">*</span>}
                            </div>
                          ) : (
                            <div className="text-[0.6rem] text-gray-300 p-1">-</div>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell className="sticky left-0 bg-white z-10 font-medium">ICU当直</TableCell>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const assignment = schedule.assignments.find((a) => a.day === day && a.shiftType === "ICU")

                      return (
                        <TableCell 
                          key={day} 
                          className={`p-1 text-center relative ${
                            dragOverCell?.day === day && dragOverCell?.shiftType === "ICU" 
                              ? "bg-green-50 border-2 border-green-300" 
                              : ""
                          }`}
                          onDragOver={(e) => handleDragOver(e, day, "ICU")}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, day, "ICU")}
                        >
                          {assignment ? (
                            <div 
                              className={`text-[0.65rem] p-1 rounded cursor-move bg-green-100 hover:bg-green-200 ${assignment.isSubstitute ? "text-red-500" : ""}`}
                              draggable
                              onDragStart={(e) => handleDragStart(e, assignment.staffId, day, "ICU")}
                            >
                              {getStaffName(assignment.staffId)}
                              {assignment.isManuallyAssigned && <span className="text-purple-500">*</span>}
                            </div>
                          ) : (
                            <div className="text-[0.6rem] text-gray-300 p-1">-</div>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="summary">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名前</TableHead>
                  <TableHead>診療科</TableHead>
                  <TableHead>経験年数</TableHead>
                  <TableHead>上限解釈</TableHead>
                  <TableHead>C当直</TableHead>
                  <TableHead>ICU当直</TableHead>
                  <TableHead>当直日</TableHead>
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
                                  ? "font-bold text-orange-500"
                                  : cShifts.length > member.maxCShifts
                                    ? "font-bold text-red-500"
                                    : ""
                              }
                            >
                              {cShifts.length}/{member.maxCShifts}
                            </span>
                            <Progress value={cPercentage} className="w-16 h-2" />
                          </div>
                          {cSubstitutes.length > 0 && (
                            <div className="text-xs text-red-500">代理: {cSubstitutes.length}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                member.limitInterpretation === "strict" && icuShifts.length < member.maxICUShifts
                                  ? "font-bold text-orange-500"
                                  : icuShifts.length > member.maxICUShifts
                                    ? "font-bold text-red-500"
                                    : ""
                              }
                            >
                              {icuShifts.length}/{member.maxICUShifts}
                            </span>
                            <Progress value={icuPercentage} className="w-16 h-2" />
                          </div>
                          {icuSubstitutes.length > 0 && (
                            <div className="text-xs text-red-500">代理: {icuSubstitutes.length}</div>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          <div className="text-xs flex flex-wrap gap-1">
                            {allShiftDays.map((day, index) => (
                              <span key={index} className="bg-gray-100 px-1 py-0.5 rounded">
                                {day}
                              </span>
                            ))}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            週末: {weekendShifts.length}回 | 前半: {firstHalfShifts.length}回 | 後半: {secondHalfShifts.length}回
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
            <div className="mt-4 text-sm">
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
                  .map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.department}, {s.yearsOfExperience}年)
                    </SelectItem>
                  ))}
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