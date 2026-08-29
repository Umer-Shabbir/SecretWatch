import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authorize";
import { parseExportQuery, exportFindingsToCSV, exportFindingsToJSON } from "@/lib/findings";
import { recordAudit } from "@/lib/audit";

export async function GET(request: Request) {
  const { session, error } = await requireAdmin();
  if (error === "unauthenticated") {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  if (error === "forbidden") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const parsedParams = parseExportQuery(searchParams);

  if (!parsedParams.success) {
    return NextResponse.json(
      { error: "invalid_request", message: parsedParams.error.message },
      { status: 400 }
    );
  }

  const query = parsedParams.data;
  const isJson = query.format === "json";

  const stream = new ReadableStream({
    async start(controller) {
      if (isJson) {
        await exportFindingsToJSON(query, controller);
      } else {
        await exportFindingsToCSV(query, controller);
      }

      // Attempt to audit the download (though it may be truncated if stream fails, this gives us a baseline).
      try {
        await recordAudit({
          userId: session!.user.id,
          action: "findings_exported",
          detail: `format=${query.format} status=${query.status ?? "all"} severity=${query.severity ?? "all"}`,
        });
      } catch (err) {
        // Just log the error, don't interrupt the stream
        console.error("Audit logging failed during export:", err);
      }
    },
  });

  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `findings_export_${timestamp}.${query.format}`;

  return new Response(stream, {
    headers: {
      "Content-Type": isJson ? "application/json" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
