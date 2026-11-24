import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await (await supabase()).auth.signOut();
  return NextResponse.redirect(new URL("/login", req.nextUrl.origin), 303);
}
