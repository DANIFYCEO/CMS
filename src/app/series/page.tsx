import { redirect } from "next/navigation";

export default function SeriesRedirect() {
  redirect("/videos?filter=series");
}
