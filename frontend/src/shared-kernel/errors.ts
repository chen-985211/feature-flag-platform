const messages: Record<string, string> = {
  UNAUTHENTICATED: '会话已失效或账号密码不正确，请重新登录。',
  FORBIDDEN: '当前账号没有此环境的修改权限。',
  CSRF_REJECTED: '请求校验失败，请刷新页面后重试。',
  INVALID_INPUT: '输入格式或字段不合法。',
  INVALID_USER_ATTRIBUTES: '请输入合法的属性 JSON 对象。',
  FLAG_NOT_FOUND: '配置不存在。',
  VERSION_NOT_FOUND: '版本不存在。',
  TARGET_NOT_FOUND: '目标环境还没有相同 Key，请先复制配置。',
  RULE_NOT_FOUND: '规则不存在。',
  FLAG_KEY_CONFLICT: '当前环境已存在相同 Key。',
  PRIORITY_CONFLICT: '优先级已被其他规则使用。',
  VERSION_CONFLICT: '配置已被更新，本地输入已保留，请查看最新版本。',
  RATE_LIMITED: '登录尝试过于频繁，请稍后重试。',
};
export class ApiError extends Error {
  constructor(
    public code: string,
    public requestID?: string,
  ) {
    super(messages[code] ?? '请求失败，请稍后重试。');
  }
}
export function feedback(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : '无法连接服务，请重试；未保存的输入已保留。';
}
