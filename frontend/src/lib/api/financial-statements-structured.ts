import { z } from "zod";
import type { ClosingFolderSummary } from "./closing-folders";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const financialStatementsStructuredCoverageSchema = z.object({
  totalLines: z.number().int().nonnegative(),
  mappedLines: z.number().int().nonnegative(),
  unmappedLines: z.number().int().nonnegative(),
  mappedShare: z.string()
});

const structuredStatementBreakdownSchema = z.object({
  code: z.string(),
  label: z.string(),
  breakdownType: z.enum(["SECTION", "LEGACY_BUCKET_FALLBACK"]),
  total: z.string()
});

const structuredStatementGroupSchema = z.object({
  code: z.string(),
  label: z.string(),
  total: z.string(),
  breakdowns: z.array(structuredStatementBreakdownSchema)
});

const structuredBalanceSheetSchema = z.object({
  groups: z.tuple([
    structuredStatementGroupSchema.extend({
      code: z.literal("BS.ASSET")
    }),
    structuredStatementGroupSchema.extend({
      code: z.literal("BS.LIABILITY")
    }),
    structuredStatementGroupSchema.extend({
      code: z.literal("BS.EQUITY")
    })
  ]),
  totals: z.object({
    totalAssets: z.string(),
    totalLiabilities: z.string(),
    totalEquity: z.string(),
    currentPeriodResult: z.string(),
    totalLiabilitiesAndEquity: z.string()
  })
});

const structuredIncomeStatementSchema = z.object({
  groups: z.tuple([
    structuredStatementGroupSchema.extend({
      code: z.literal("PL.REVENUE")
    }),
    structuredStatementGroupSchema.extend({
      code: z.literal("PL.EXPENSE")
    })
  ]),
  totals: z.object({
    totalRevenue: z.string(),
    totalExpenses: z.string(),
    netResult: z.string()
  })
});

const structuredFinancialStatementsBaseSchema = z.object({
  closingFolderId: z.string().uuid(),
  presentationType: z.literal("STRUCTURED_PREVIEW"),
  isStatutory: z.literal(false)
});

const financialStatementsStructuredNoDataSchema =
  structuredFinancialStatementsBaseSchema.extend({
    statementState: z.literal("NO_DATA"),
    latestImportVersion: z.null(),
    coverage: financialStatementsStructuredCoverageSchema.extend({
      totalLines: z.literal(0),
      mappedLines: z.literal(0),
      unmappedLines: z.literal(0),
      mappedShare: z.literal("0")
    }),
    balanceSheet: z.null(),
    incomeStatement: z.null()
  });

const financialStatementsStructuredBlockedSchema =
  structuredFinancialStatementsBaseSchema.extend({
    statementState: z.literal("BLOCKED"),
    latestImportVersion: z.number().int().positive(),
    coverage: financialStatementsStructuredCoverageSchema,
    balanceSheet: z.null(),
    incomeStatement: z.null()
  });

const financialStatementsStructuredPreviewReadySchema =
  structuredFinancialStatementsBaseSchema.extend({
    statementState: z.literal("PREVIEW_READY"),
    latestImportVersion: z.number().int().positive(),
    coverage: financialStatementsStructuredCoverageSchema.extend({
      unmappedLines: z.literal(0),
      mappedShare: z.literal("1")
    }),
    balanceSheet: structuredBalanceSheetSchema,
    incomeStatement: structuredIncomeStatementSchema
  });

const financialStatementsStructuredSchema = z.discriminatedUnion("statementState", [
  financialStatementsStructuredNoDataSchema,
  financialStatementsStructuredBlockedSchema,
  financialStatementsStructuredPreviewReadySchema
]);

export type StructuredFinancialStatementsPreview = z.infer<
  typeof financialStatementsStructuredSchema
>;

export type FinancialStatementsStructuredShellState =
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
  | { kind: "ready"; financialStatements: StructuredFinancialStatementsPreview };

export async function loadFinancialStatementsStructuredShellState(
  closingFolderId: string,
  closingFolder: ClosingFolderSummary,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<FinancialStatementsStructuredShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/financial-statements/structured`,
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

    const parsed = financialStatementsStructuredSchema.safeParse(payload);

    if (
      !parsed.success ||
      !isFinancialStatementsStructuredCoherent(parsed.data, closingFolderId, closingFolder)
    ) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      financialStatements: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

function isFinancialStatementsStructuredCoherent(
  financialStatements: StructuredFinancialStatementsPreview,
  closingFolderId: string,
  closingFolder: ClosingFolderSummary
) {
  return (
    financialStatements.closingFolderId === closingFolderId &&
    financialStatements.closingFolderId === closingFolder.id
  );
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
