import { Priority, Role } from "./types";
import { AlertCircle, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import React from "react";

export const PRIORITY_COLORS = {
  [Priority.LOW]: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  [Priority.MEDIUM]: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  [Priority.HIGH]: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  [Priority.CRITICAL]: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export const ROLE_BADGES = {
  [Role.ADMIN]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  [Role.PRODUCTION]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  [Role.ENGINEERING]: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
};

export const MOCK_USERS = [
  {
    id: 'u1',
    username: 'admin',
    password: '1234',
    fullName: 'Admin User',
    role: Role.ADMIN
  },
  {
    id: 'u2',
    username: 'sarahp',
    password: 'password',
    fullName: 'Sarah P',
    role: Role.PRODUCTION
  },
  {
    id: 'u3',
    username: 'mikee',
    password: 'password',
    fullName: 'Mike E',
    role: Role.ENGINEERING
  }
];

// Placeholder for an empty image
export const PLACEHOLDER_IMG = "https://picsum.photos/400/300?grayscale";
