import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import {
  updateRepositoryFilter,
  deleteRepositoryFilter,
  InvalidFilterError,
  FilterNotFoundError
} from "@/lib/repository-filters";
import { recordAudit } from "@/lib/audit";
import { RepositoryFilterType } from "@prisma/client";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  // All fields optional for update
  if (type !== undefined && type !== "ALLOW" && type !== "BLOCK") {
    return NextResponse.json({ message: "type must be ALLOW or BLOCK" }, { status: 400 });
  }
  if (pattern !== undefined && typeof pattern !== "string") {
    return NextResponse.json({ message: "pattern must be a string" }, { status: 400 });
  }
  if (enabled !== undefined && typeof enabled !== "boolean") {
    return NextResponse.json({ message: "enabled must be a boolean" }, { status: 400 });
  }

  try {
    const updated = await updateRepositoryFilter(params.id, {
      type: type as RepositoryFilterType | undefined,
      pattern: pattern as string | undefined,
      enabled: enabled as boolean | undefined,
    });

    await recordAudit({
      userId: session!.user.id,
      action: "repository_filter_updated",
      detail: JSON.stringify({ id: updated.id, type: updated.type, pattern: updated.pattern, enabled: updated.enabled }),
    });

    return NextResponse.json({ filter: updated });
  } catch (err) {
    if (err instanceof FilterNotFoundError) {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }
    if (err instanceof InvalidFilterError) {
      return NextResponse.json({ message: err.reason }, { status: 400 });
    }
    return NextResponse.json({ message: "Could not update repository filter" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await deleteRepositoryFilter(params.id);

    await recordAudit({
      userId: session!.user.id,
      action: "repository_filter_deleted",
      detail: JSON.stringify({ id: params.id }),
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof FilterNotFoundError) {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }
    return NextResponse.json({ message: "Could not delete repository filter" }, { status: 500 });
  }
}
