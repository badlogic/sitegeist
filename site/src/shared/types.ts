// Shared types between frontend and backend

export interface EmailSignup {
  email: string;
  timestamp: string; // ISO 8601
  notified: boolean; // Has launch email been sent?
}

export interface SignupRequest {
  email: string;
}

export interface SignupResponse {
  success: true;
}

export interface ErrorResponse {
  error: string;
}
