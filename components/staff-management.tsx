"use client"
import { Input } from "@/components/ui/input"
import type { Staff } from "@/lib/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface StaffManagementProps {
  staff: Staff[]
  onStaffUpdate: (staff: Staff[]) => void
}

export default function StaffManagement({ staff, onStaffUpdate }: StaffManagementProps) {
  const handleStaffChange = (index: number, field: keyof Staff, value: string | number) => {
    const updatedStaff = [...staff]

    if (
      field === "yearsOfExperience" ||
      field === "maxCShifts" ||
      field === "maxICUShifts" ||
      field === "maxHolidayShifts"
    ) {
      updatedStaff[index][field] = Number(value) || 0
    } else {
      updatedStaff[index][field] = value as string
    }

    onStaffUpdate(updatedStaff)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">スタッフ情報 (40名まで)</h2>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No.</TableHead>
              <TableHead>診療科</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>経験年数</TableHead>
              <TableHead>C当直上限</TableHead>
              <TableHead>ICU当直上限</TableHead>
              <TableHead>休日出勤上限</TableHead>
              <TableHead>上限解釈</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map((member, index) => (
              <TableRow key={member.id}>
                <TableCell>{index + 1}</TableCell>
                <TableCell>
                  <Input
                    value={member.department}
                    onChange={(e) => handleStaffChange(index, "department", e.target.value)}
                    placeholder="診療科"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={member.name}
                    onChange={(e) => handleStaffChange(index, "name", e.target.value)}
                    placeholder="名前"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={member.yearsOfExperience}
                    onChange={(e) => handleStaffChange(index, "yearsOfExperience", e.target.value)}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={member.maxCShifts}
                    onChange={(e) => handleStaffChange(index, "maxCShifts", e.target.value)}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={member.maxICUShifts}
                    onChange={(e) => handleStaffChange(index, "maxICUShifts", e.target.value)}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    value={member.maxHolidayShifts}
                    onChange={(e) => handleStaffChange(index, "maxHolidayShifts", e.target.value)}
                    placeholder="0"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={member.limitInterpretation || "normal"}
                    onValueChange={(value) => handleStaffChange(index, "limitInterpretation", value)}
                  >
                    <SelectTrigger className="w-[80px]">
                      <SelectValue placeholder="通常" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strict">○</SelectItem>
                      <SelectItem value="flexible">△</SelectItem>
                      <SelectItem value="normal">-</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
