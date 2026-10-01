export const COOKIE_NAME = "app_session";
export const UNAUTHED_ERR_MSG = "UNAUTHORIZED";
export const NOT_ADMIN_ERR_MSG = "NOT_ADMIN";
export const AXIOS_TIMEOUT_MS = 30000;
export const ONE_YEAR_MS = 31536000000;

export function decodeOAuthState(state: string) {
  try {
    return JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
  } catch {
    return { redirectUri: "/" };
  }
}
