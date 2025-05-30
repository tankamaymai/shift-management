"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import StaffManagement from "./staff-management"
import PreferenceInput from "./preference-input"
import GeneratedSchedule from "./generated-schedule"
import HolidayManager from "./holiday-manager"
import type { Staff, Schedule, Preference, AppState } from "@/lib/types"
import { generateSchedule } from "@/lib/schedule-generator"
import { exportToExcel } from "@/lib/excel-export"
import { saveToLocalStorage, loadFromLocalStorage, clearLocalStorage } from "@/lib/local-storage"
import { exportToJson, importFromJson } from "@/lib/json-export-import"
import { AlertCircle, Save, Download, RefreshCw, Upload, FileJson, Trash2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function ShiftManagement() {
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear())
  const [staff, setStaff] = useState<Staff[]>([])
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [generatedSchedule, setGeneratedSchedule] = useState<Schedule | null>(null)
  const [activeTab, setActiveTab] = useState("staff")
  const [holidays, setHolidays] = useState<number[]>([])
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = useState(false)
  const [regenerateMonth, setRegenerateMonth] = useState<number>(currentMonth)

  // Initialize with some empty staff members and load from localStorage
  useEffect(() => {
    const savedState = loadFromLocalStorage()

    if (savedState) {
      setStaff(savedState.staff)
      setPreferences(savedState.preferences)
      setGeneratedSchedule(savedState.schedule)
      setCurrentMonth(savedState.currentMonth)
      setCurrentYear(savedState.currentYear)
      setHolidays(savedState.holidays || [])
    } else if (staff.length === 0) {
      const initialStaff: Staff[] = Array(40)
        .fill(null)
        .map((_, index) => ({
          id: `staff-${index + 1}`,
          name: "",
          department: "",
          yearsOfExperience: 0,
          maxCShifts: 0,
          maxICUShifts: 0,
          maxHolidayShifts: 0,
          limitInterpretation: "normal", // デフォルトは通常
        }))
      setStaff(initialStaff)
    }
  }, [staff.length])

  // Get days in month
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)

  // Handle month change
  const handleMonthChange = (month: number) => {
    setCurrentMonth(month)
    setRegenerateMonth(month)
    // Reset generated schedule when month changes
    setGeneratedSchedule(null)
  }

  // Handle staff update
  const handleStaffUpdate = (updatedStaff: Staff[]) => {
    setStaff(updatedStaff)
  }

  // Handle preference update
  const handlePreferenceUpdate = (updatedPreferences: Preference[]) => {
    setPreferences(updatedPreferences)
  }

  // Handle holidays update
  const handleHolidaysUpdate = (updatedHolidays: number[]) => {
    setHolidays(updatedHolidays)
  }

  // Handle schedule update (for manual adjustments)
  const handleScheduleUpdate = (updatedSchedule: Schedule) => {
    setGeneratedSchedule(updatedSchedule)
  }

  // Generate schedule
  const handleGenerateSchedule = () => {
    const validStaff = staff.filter((s) => s.name && s.department)
    if (validStaff.length === 0) {
      alert("スタッフ情報を入力してください。")
      return
    }

    const schedule = generateSchedule(validStaff, preferences, daysInMonth, currentYear, currentMonth, holidays)

    setGeneratedSchedule(schedule)
    setActiveTab("generated")
  }

  // Handle regenerate schedule
  const handleRegenerateSchedule = () => {
    setCurrentMonth(regenerateMonth)
    setIsRegenerateDialogOpen(false)

    // Wait for state update to complete
    setTimeout(() => {
      handleGenerateSchedule()
    }, 100)
  }

  // Export to Excel
  const handleExport = () => {
    if (!generatedSchedule) {
      alert("先にスケジュールを生成してください。")
      return
    }

    exportToExcel(generatedSchedule, staff, preferences, daysInMonth, currentYear, currentMonth)
  }

  // Save to localStorage
  const handleSave = () => {
    const appState: AppState = {
      staff,
      preferences,
      schedule: generatedSchedule,
      currentMonth,
      currentYear,
      holidays,
    }

    saveToLocalStorage(appState)
    setSaveMessage("データが保存されました")

    // Clear message after 3 seconds
    setTimeout(() => {
      setSaveMessage(null)
    }, 3000)
  }

  // Clear localStorage
  const handleClear = () => {
    if (confirm("保存されたデータをすべて削除しますか？")) {
      clearLocalStorage()
      window.location.reload()
    }
  }

  // Export to JSON
  const handleExportJson = () => {
    const appState: AppState = {
      staff,
      preferences,
      schedule: generatedSchedule,
      currentMonth,
      currentYear,
      holidays,
    }

    exportToJson(appState)
  }

  // Import from JSON
  const handleImportJson = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const importedState = await importFromJson(file)
      setStaff(importedState.staff)
      setPreferences(importedState.preferences)
      setGeneratedSchedule(importedState.schedule)
      setCurrentMonth(importedState.currentMonth)
      setCurrentYear(importedState.currentYear)
      setHolidays(importedState.holidays || [])

      saveToLocalStorage(importedState)
      setSaveMessage("データがインポートされました")

      // Clear message after 3 seconds
      setTimeout(() => {
        setSaveMessage(null)
      }, 3000)
    } catch (error) {
      alert(`インポートに失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`)
    }

    // Reset the file input
    if (event.target) {
      event.target.value = ""
    }
  }

  // Clear current schedule
  const handleClearSchedule = () => {
    if (confirm("現在のスケジュールをクリアしますか？")) {
      setGeneratedSchedule(null)
    }
  }

  const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <select
            className="border rounded p-2"
            value={currentMonth}
            onChange={(e) => handleMonthChange(Number.parseInt(e.target.value))}
          >
            {monthNames.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>
          <span className="text-lg font-medium">
            {currentYear}年 {monthNames[currentMonth]} ({daysInMonth}日)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {generatedSchedule ? (
            <Dialog open={isRegenerateDialogOpen} onOpenChange={setIsRegenerateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  スケジュール再生成
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>スケジュール再生成</DialogTitle>
                  <DialogDescription>既存のスケジュールを上書きして新しいスケジュールを生成します。</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="month" className="text-right">
                      月を選択
                    </Label>
                    <Select
                      value={regenerateMonth.toString()}
                      onValueChange={(value) => setRegenerateMonth(Number(value))}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="月を選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthNames.map((name, index) => (
                          <SelectItem key={index} value={index.toString()}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsRegenerateDialogOpen(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={handleRegenerateSchedule}>再生成</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Button onClick={handleGenerateSchedule}>
              <RefreshCw className="mr-2 h-4 w-4" />
              スケジュール自動生成
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} disabled={!generatedSchedule}>
            <Download className="mr-2 h-4 w-4" />
            Excelにエクスポート
          </Button>
          <Button variant="secondary" onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" />
            ローカルに保存
          </Button>
          <Button variant="outline" onClick={handleExportJson}>
            <FileJson className="mr-2 h-4 w-4" />
            JSONエクスポート
          </Button>
          <Button variant="outline" onClick={handleImportJson}>
            <Upload className="mr-2 h-4 w-4" />
            JSONインポート
          </Button>
          {generatedSchedule && (
            <Button variant="destructive" size="icon" onClick={handleClearSchedule} title="スケジュールをクリア">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            style={{ display: "none" }}
          />
        </div>
      </div>

      {saveMessage && (
        <Alert className="bg-green-50 border-green-200">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-600">保存完了</AlertTitle>
          <AlertDescription className="text-green-600">{saveMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-[500px]">
          <TabsTrigger value="staff">スタッフ情報</TabsTrigger>
          <TabsTrigger value="preferences">希望入力</TabsTrigger>
          <TabsTrigger value="holidays">祝日設定</TabsTrigger>
          <TabsTrigger value="generated">生成されたスケジュール</TabsTrigger>
        </TabsList>

        <TabsContent value="staff">
          <Card>
            <CardContent className="pt-6">
              <StaffManagement staff={staff} onStaffUpdate={handleStaffUpdate} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardContent className="pt-6">
              <PreferenceInput
                staff={staff.filter((s) => s.name)}
                daysInMonth={daysInMonth}
                preferences={preferences}
                onPreferenceUpdate={handlePreferenceUpdate}
                year={currentYear}
                month={currentMonth}
                holidays={holidays}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="holidays">
          <Card>
            <CardContent className="pt-6">
              <HolidayManager
                holidays={holidays}
                month={currentMonth}
                year={currentYear}
                onHolidaysChange={handleHolidaysUpdate}
              />
              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-2">
                  注意: 日曜日は自動的に日勤が割り当てられます。祝日のみこちらで設定してください。
                </p>
                <Button variant="destructive" size="sm" onClick={handleClear}>
                  保存データをクリア
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="generated">
          <Card>
            <CardContent className="pt-6">
              <GeneratedSchedule
                schedule={generatedSchedule}
                staff={staff}
                preferences={preferences}
                daysInMonth={daysInMonth}
                holidays={holidays}
                onScheduleUpdate={handleScheduleUpdate}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
