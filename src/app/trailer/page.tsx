import { redirect } from "next/navigation";

export default function TrailerRedirect() {
  redirect("/videos?filter=trailers");
}
