export interface Session {
  user: { id: string; username: string; display_name: string; role: string };
  write_environments: string[];
  csrf_token: string;
}
export interface Identity {
  session(signal?: AbortSignal): Promise<Session>;
  login(username: string, password: string): Promise<Session>;
  logout(): Promise<void>;
}
