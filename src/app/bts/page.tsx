import { redirect } from "next/navigation";

export default function BtsRedirect() {
  redirect("/videos?filter=bts");
}
