import type { NextRequest } from "next/server";
import { json, originOf, preflight, resourceMetadata } from "@/lib/oauth";

export const GET = (req: NextRequest) => json(resourceMetadata(originOf(req)));
export const OPTIONS = preflight;
