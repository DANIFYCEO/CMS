import { redirect } from "next/navigation";

export default function MusicRedirect() {
  redirect("/videos?filter=music");
}
