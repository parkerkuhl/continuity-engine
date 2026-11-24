import type { NextRequest } from "next/server";
import { json, originOf, preflight, serverMetadata } from "@/lib/oauth";

export const GET = (req: NextRequest) => json(serverMetadata(originOf(req)));
export const OPTIONS = preflight;
