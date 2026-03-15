export interface RunActivity {
  id: string;
  date: string;
  distance: number; // in km
  duration: number; // in seconds
  pace: string; // min/km
  calories: number;
  route: string;
}

export interface UserStats {
  totalDistance: number;
  totalRuns: number;
  averagePace: string;
  weeklyGoal: number;
  currentWeeklyProgress: number;
}
