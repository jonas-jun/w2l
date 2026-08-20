import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .single();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <p className="text-lg font-semibold">{profile?.nickname}</p>
      <SignOutButton />
    </main>
  );
}
