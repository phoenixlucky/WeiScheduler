export type RunnerType = "python" | "conda-name" | "conda-path" | "cmd" | "executable";
export type TaskStatus = "running" | "stopping" | "retrying" | "success" | "failed" | "never" | "stopped";

export interface EnvironmentVariable {
  key: string;
  value: string;
}

export interface RunLog {
  id: string;
  executionId: string;
  attempt: number;
  maxAttempts: number;
  startedAt: string;
  finishedAt?: string;
  status: TaskStatus;
  command: string;
  commandArgs: string[];
  stdout: string;
  stderr: string;
}

export interface Task {
  id: string;
  name: string;
  runnerType: RunnerType;
  commandPath: string;
  condaTarget: string;
  scriptPath: string;
  args: string;
  timeArgName: string;
  timeArgValue: string;
  workingDirectory: string;
  environment: EnvironmentVariable[];
  retryCount: number;
  retryDelaySeconds: number;
  schedule: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  lastStatus: TaskStatus;
  lastError: string;
  logs: RunLog[];
  running?: boolean;
  nextRunAt?: string | null;
  liveLog?: RunLog;
}

export type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "lastStatus" | "lastError" | "logs" | "running" | "nextRunAt" | "liveLog"> & { id?: string };

export const emptyTask = (): TaskInput => ({
  name: "",
  runnerType: "python",
  commandPath: "",
  condaTarget: "",
  scriptPath: "",
  args: "",
  timeArgName: "",
  timeArgValue: "",
  workingDirectory: "",
  environment: [],
  retryCount: 0,
  retryDelaySeconds: 60,
  schedule: "*/5 * * * *",
  enabled: true,
});
