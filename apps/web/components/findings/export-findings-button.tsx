"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FindingSeverity } from "@secretwatch/shared";

interface ExportFindingsButtonProps {
  severityFilter?: FindingSeverity | "ALL";
  className?: string;
}

export function ExportFindingsButton({
  severityFilter = "ALL",
  className = "",
}: ExportFindingsButtonProps) {
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: "csv" | "json") {
    if (exporting) return;

    setExporting(format);
    setError(null);
    try {
      const params = new URLSearchParams({
        format,
        status: "PENDING",
      });

      if (severityFilter && severityFilter !== "ALL") {
        params.set("severity", severityFilter);
      }

      const url = `/api/findings/export?${params.toString()}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = downloadUrl;

      const disposition = response.headers.get("Content-Disposition");
      let filename = `findings_export.${format}`;

      if (disposition && disposition.indexOf("filename=") !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, "");
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error(`Export to ${format.toUpperCase()} failed:`, err);
      setError("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          onClick={() => handleExport("csv")}
          loading={exporting === "csv"}
          disabled={exporting !== null}
          className="w-auto h-8 px-3 text-xs font-medium"
        >
          Export CSV
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleExport("json")}
          loading={exporting === "json"}
          disabled={exporting !== null}
          className="w-auto h-8 px-3 text-xs font-medium"
        >
          Export JSON
        </Button>
      </div>
      {error && (
        <span role="alert" className="text-xs text-danger-fg">
          {error}
        </span>
      )}
    </div>
  );
}
