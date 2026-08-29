import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { listRepositoryFilters, createRepositoryFilter, InvalidFilterError } from "@/lib/repository-filters";
import { recordAudit } from "@/lib/audit";
import { RepositoryFilterType } from "@prisma/client";

export async function GET() {
  const { error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const filters = await listRepositoryFilters();
    return NextResponse.json({ filters });
  } catch (err) {
    return NextResponse.json({ message: "Could not load repository filters" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { type, pattern, enabled } = (body as Record<string, unknown>) ?? {};

  if (!type || typeof type !== "string") {
    return NextResponse.json({ message: "type is required" }, { status: 400 });
  }
  if (!pattern || typeof pattern !== "string") {
    return NextResponse.json({ message: "pattern is required" }, { status: 400 });
  }

  try {
    const created = await createRepositoryFilter({
      type: type as RepositoryFilterType,
      pattern,
      enabled: typeof enabled === "boolean" ? enabled : true,
    });

    await recordAudit({
      userId: session!.user.id,
      action: "repository_filter_created",
      detail: JSON.stringify({ id: created.id, type: created.type, pattern: created.pattern }),
    });

    return NextResponse.json({ filter: created }, { status: 201 });
  } catch (err) {
    if (err instanceof InvalidFilterError) {
      return NextResponse.json({ message: err.reason }, { status: 400 });
    }
    return NextResponse.json({ message: "Could not create repository filter" }, { status: 500 });
  }
}
