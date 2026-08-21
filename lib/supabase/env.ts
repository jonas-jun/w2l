/** 비어 있는 환경 변수를 조기에 잡는다 — 없으면 어차피 첫 요청에서 죽는다. */
export function requiredEnv(name: string, value: string | undefined): string {
  if (!value) throw new Error(`환경 변수 ${name} 가 비어 있다. .env.local 을 확인하라.`);
  return value;
}
