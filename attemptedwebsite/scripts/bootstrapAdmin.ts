import { getSupabaseAdmin } from "../lib/supabase/admin";

async function main() {
  const discordId = process.argv[2];
  if (!discordId) {
    throw new Error("Discord ID is required. Pass it as the first argument.");
  }

  const supabase = getSupabaseAdmin();
  const { data: user, error: lookupError } = await supabase
    .from("users")
    .select("id, siteRole, rolesVersion")
    .eq("discordId", discordId)
    .maybeSingle();
  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!user) {
    throw new Error(`No user found with Discord ID ${discordId}.`);
  }

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update({
      siteRole: "ADMIN",
      rolesVersion: (user?.rolesVersion ?? 0) + 1,
    })
    .eq("discordId", discordId)
    .select("id")
    .single();
  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to update user.");
  }

  console.log(
    `User ${updated.id} (${discordId}) is now ADMIN (rolesVersion=${user.rolesVersion + 1}).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    return;
  });
