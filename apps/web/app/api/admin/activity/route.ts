import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { prisma } from "@/lib/db";

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status: error === "forbidden" ? 403 : 401 });
  }

  const { searchParams } = new URL(request.url);
  const pageParam = searchParams.get("page");
  const pageSizeParam = searchParams.get("pageSize");

  const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
  const pageSize = pageSizeParam ? Math.min(50, Math.max(1, parseInt(pageSizeParam, 10))) : PAGE_SIZE;

  try {
    const [total, rows] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          userId: true,
          action: true,
          detail: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      logs: rows,
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
