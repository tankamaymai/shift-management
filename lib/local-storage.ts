import type { AppState } from "./types"

const STORAGE_KEY = "shift-management-app-state"

export function saveToLocalStorage(state: AppState): void {
  try {
    // Convert dates to strings for storage
    const stateToSave = {
      ...state,
      preferences: state.preferences.map((pref) => ({
        ...pref,
        date: pref.date.toISOString(),
      })),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
  } catch (error) {
    console.error("Error saving to localStorage:", error)
  }
}

export function loadFromLocalStorage(): AppState | null {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY)
    if (!savedState) return null

    const parsedState = JSON.parse(savedState)

    // Convert date strings back to Date objects
    return {
      ...parsedState,
      preferences: parsedState.preferences.map((pref: any) => ({
        ...pref,
        date: new Date(pref.date),
      })),
    }
  } catch (error) {
    console.error("Error loading from localStorage:", error)
    return null
  }
}

export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Error clearing localStorage:", error)
  }
}
