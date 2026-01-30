import HeaderClient from "@/components/HeaderClient";
import { getSession } from "@/lib/auth/session";

export default async function Header() {
  const session = await getSession();
  return <HeaderClient session={session} />;
}
