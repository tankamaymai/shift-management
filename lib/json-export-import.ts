import type { AppState } from "./types"

export function exportToJson(state: AppState): void {
  try {
    // Convert dates to strings for storage
    const stateToExport = {
      ...state,
      preferences: state.preferences.map((pref) => ({
        ...pref,
        date: pref.date.toISOString(),
      })),
    }

    // Create a Blob with the JSON data
    const jsonString = JSON.stringify(stateToExport, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })

    // Create a download link and trigger the download
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `当直シフト_${state.currentYear}年${state.currentMonth + 1}月.json`
    document.body.appendChild(a)
    a.click()

    // Clean up
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error("Error exporting to JSON:", error)
    alert("JSONエクスポート中にエラーが発生しました")
  }
}

export function importFromJson(file: File): Promise<AppState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        if (!event.target?.result) {
          reject(new Error("ファイルの読み込みに失敗しました"))
          return
        }

        const jsonString = event.target.result as string
        const parsedState = JSON.parse(jsonString)

        // Convert date strings back to Date objects
        const importedState: AppState = {
          ...parsedState,
          preferences: parsedState.preferences.map((pref: any) => ({
            ...pref,
            date: new Date(pref.date),
          })),
        }

        resolve(importedState)
      } catch (error) {
        console.error("Error parsing JSON:", error)
        reject(new Error("JSONの解析に失敗しました"))
      }
    }

    reader.onerror = () => {
      reject(new Error("ファイルの読み込みに失敗しました"))
    }

    reader.readAsText(file)
  })
}
