import { z } from "zod";
import type { ClosingFolderSummary } from "./closing-folders";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const financialSummaryStateSchema = z.enum(["NO_DATA", "PREVIEW_PARTIAL", "PREVIEW_READY"]);

const financialSummaryCoverageSchema = z.object({
  totalLines: z.number().int().nonnegative(),
  mappedLines: z.number().int().nonnegative(),
  unmappedLines: z.number().int().nonnegative(),
  mappedShare: z.string()
});

const unmappedBalanceImpactSchema = z.object({
  debitTotal: z.string(),
  creditTotal: z.string(),
  netDebitMinusCredit: z.string()
});

const balanceSheetSummarySchema = z.object({
  assets: z.string(),
  liabilities: z.string(),
  equity: z.string(),
  currentPeriodResult: z.string(),
  totalAssets: z.string(),
  totalLiabilitiesAndEquity: z.string()
});

const incomeStatementSummarySchema = z.object({
  revenue: z.string(),
  expenses: z.string(),
  netResult: z.string()
});

const financialSummaryPreviewSchema = z.object({
  closingFolderId: z.string().uuid(),
  statementState: financialSummaryStateSchema,
  latestImportVersion: z.number().int().positive().nullable(),
  coverage: financialSummaryCoverageSchema,
  unmappedBalanceImpact: unmappedBalanceImpactSchema,
  balanceSheetSummary: balanceSheetSummarySchema.nullable(),
  incomeStatementSummary: incomeStatementSummarySchema.nullable()
});

export type FinancialSummaryPreview = z.infer<typeof financialSummaryPreviewSchema>;
export type FinancialSummaryPreviewState = FinancialSummaryPreview["statementState"];

export type FinancialSummaryShellState =
  | { kind: "loading" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" }
  | { kind: "ready"; summary: FinancialSummaryPreview };

export async function loadFinancialSummaryShellState(
  closingFolderId: string,
  closingFolder: ClosingFolderSummary,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<FinancialSummaryShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/financial-summary`,
      {
        method: "GET",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 400) {
      return { kind: "bad_request" };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    if (response.status !== 200) {
      return { kind: "unexpected" };
    }

    const payload = await readJsonBody(response);

    if (payload === undefined) {
      return { kind: "invalid_payload" };
    }

    const parsed = financialSummaryPreviewSchema.safeParse(payload);

    if (
      !parsed.success ||
      !isFinancialSummaryPreviewCoherent(parsed.data, closingFolderId, closingFolder)
    ) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      summary: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

function isFinancialSummaryPreviewCoherent(
  summary: FinancialSummaryPreview,
  closingFolderId: string,
  closingFolder: ClosingFolderSummary
) {
  if (
    summary.closingFolderId !== closingFolderId ||
    summary.closingFolderId !== closingFolder.id
  ) {
    return false;
  }

  if (summary.statementState === "NO_DATA") {
    return (
      summary.latestImportVersion === null &&
      summary.balanceSheetSummary === null &&
      summary.incomeStatementSummary === null &&
      summary.coverage.totalLines === 0 &&
      summary.coverage.mappedLines === 0 &&
      summary.coverage.unmappedLines === 0 &&
      summary.coverage.mappedShare === "0" &&
      summary.unmappedBalanceImpact.debitTotal === "0" &&
      summary.unmappedBalanceImpact.creditTotal === "0" &&
      summary.unmappedBalanceImpact.netDebitMinusCredit === "0"
    );
  }

  if (
    summary.latestImportVersion === null ||
    summary.balanceSheetSummary === null ||
    summary.incomeStatementSummary === null
  ) {
    return false;
  }

  if (summary.statementState === "PREVIEW_PARTIAL") {
    return true;
  }

  return (
    summary.coverage.unmappedLines === 0 &&
    summary.coverage.mappedShare === "1" &&
    summary.unmappedBalanceImpact.debitTotal === "0" &&
    summary.unmappedBalanceImpact.creditTotal === "0" &&
    summary.unmappedBalanceImpact.netDebitMinusCredit === "0"
  );
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
