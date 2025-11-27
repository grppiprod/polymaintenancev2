export enum Role {
  ADMIN = 'ADMIN',
  PRODUCTION = 'PRODUCTION',
  ENGINEERING = 'ENGINEERING',
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum LogType {
  REPAIR = 'REPAIR',
  PREVENTIVE_MAINTENANCE = 'PREVENTIVE_MAINTENANCE',
}

export enum LogStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
}

export interface User {
  id: string;
  username: string;
  password?: string; // Optional for display purposes, required for auth
  fullName: string;
  role: Role;
}

export interface HistoryItem {
  id: string;
  content: string;
  createdBy: string; // UserId
  creatorName: string;
  creatorRole: Role;
  createdAt: string; // ISO Date string
}

export interface MaintenanceLog {
  id: string;
  title: string;
  description: string;
  type: LogType;
  priority: Priority;
  status: LogStatus;
  imageUrl?: string;
  createdBy: string; // UserId
  creatorName: string;
  creatorRole: Role;
  createdAt: string; // ISO Date string
  closedAt?: string;
  history: HistoryItem[];
}
