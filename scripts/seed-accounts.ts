import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CSV_PATH = new URL("./accounts.local.csv", import.meta.url);

interface Account {
  email: string;
  password: string;
  nickname: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`환경 변수 ${name} 가 비어 있다.`);
  }
  return value;
}

function parseCsv(text: string): Account[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const [header, ...rows] = lines;
  if (!header) {
    return [];
  }

  const columns = header.split(",").map((c) => c.trim());
  const emailIdx = columns.indexOf("email");
  const passwordIdx = columns.indexOf("password");
  const nicknameIdx = columns.indexOf("nickname");

  if (emailIdx === -1 || passwordIdx === -1 || nicknameIdx === -1) {
    throw new Error("CSV 헤더는 email,password,nickname 이어야 한다.");
  }

  return rows.map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    return {
      email: cells[emailIdx],
      password: cells[passwordIdx],
      nickname: cells[nicknameIdx],
    };
  });
}

async function seedAccount(
  supabase: SupabaseClient,
  account: Account,
  emailToId: Map<string, string>,
) {
  const { email, password, nickname } = account;
  let userId = emailToId.get(email.toLowerCase());

  if (userId) {
    console.log(`skip (계정 존재): ${email}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      console.error(`가입 실패: ${email} — ${error?.message}`);
      return;
    }

    userId = data.user.id;
    emailToId.set(email.toLowerCase(), userId);
    console.log(`계정 생성: ${email}`);
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) {
    console.log(`skip (프로필 존재): ${nickname}`);
    return;
  }

  const { error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId, nickname });

  if (insertError) {
    console.error(`프로필 생성 실패: ${nickname} — ${insertError.message}`);
    return;
  }

  console.log(`프로필 생성: ${nickname}`);
}

async function main() {
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  let csvText: string;
  try {
    csvText = readFileSync(CSV_PATH, "utf-8");
  } catch {
    throw new Error(
      "scripts/accounts.local.csv 를 찾을 수 없다. email,password,nickname 헤더로 로컬에 만들어라 (커밋 금지).",
    );
  }

  const accounts = parseCsv(csvText);
  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) {
    throw listError;
  }

  const emailToId = new Map(
    usersData.users
      .filter((u): u is typeof u & { email: string } => Boolean(u.email))
      .map((u) => [u.email.toLowerCase(), u.id]),
  );

  for (const account of accounts) {
    await seedAccount(supabase, account, emailToId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
