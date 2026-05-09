import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import type {
  MappingSuggestion,
  MappingSuggestionDecision,
  MappingSuggestionDecisionRequest,
  MappingSuggestionDecisionResult,
  MappingSuggestionDecisionState,
  MappingSuggestionError,
  MappingSuggestionsReadModel,
  MappingSuggestionsShellState,
  MappingSuggestionsState
} from "../lib/api/mapping-suggestions";
import {
  generateMappingSuggestionDecisionIdempotencyKey,
  loadMappingSuggestionsShellState,
  recordMappingSuggestionDecision
} from "../lib/api/mapping-suggestions";
import type { ActiveTenant } from "../lib/api/me";

export type AiMappingSuggestionReviewTarget = {
  code: string;
  label: string;
  selectable: boolean;
};

type AiMappingSuggestionsPanelProps = {
  activeTenant: ActiveTenant;
  closingFolderId: string;
  selectableTargets?: AiMappingSuggestionReviewTarget[];
  onManualMappingMutationConfirmed?: () => Promise<void> | void;
};

const stateLabels: Record<MappingSuggestionsState, string> = {
  DISABLED: "AI mapping suggestion disabled.",
  NO_IMPORT: "No balance import available for AI mapping suggestion.",
  READY: "AI mapping suggestion ready.",
  PARTIAL: "Partial AI mapping suggestion coverage.",
  ARCHIVED_READ_ONLY: "Archived read-only suggestion.",
  UNAVAILABLE: "AI mapping suggestion unavailable.",
  TIMEOUT: "AI mapping suggestion timeout.",
  INVALID_MODEL_OUTPUT: "AI mapping suggestion output unavailable for review.",
  INSUFFICIENT_EVIDENCE: "Insufficient evidence for AI mapping suggestion."
};

type DecisionReviewState =
  | { kind: "idle" }
  | { kind: "submitting"; decision: MappingSuggestionDecision }
  | {
      kind: "success";
      result: MappingSuggestionDecisionResult;
      refreshSuggestionsFailed: boolean;
      refreshManualMappingFailed: boolean;
    }
  | (Exclude<MappingSuggestionDecisionState, { kind: "success" }> & {
      decision: MappingSuggestionDecision;
    });

type DecisionAttempt = {
  canonicalPayload: string;
  idempotencyKey: string;
};

export function AiMappingSuggestionsPanel({
  activeTenant,
  closingFolderId,
  selectableTargets = [],
  onManualMappingMutationConfirmed
}: AiMappingSuggestionsPanelProps) {
  const [state, setState] = useState<MappingSuggestionsShellState>({ kind: "loading" });
  const [correctTargetByAccount, setCorrectTargetByAccount] = useState<Record<string, string>>({});
  const [reviewCommentByAccount, setReviewCommentByAccount] = useState<Record<string, string>>({});
  const [decisionStateByAccount, setDecisionStateByAccount] = useState<
    Record<string, DecisionReviewState | undefined>
  >({});
  const decisionAttemptByAccountRef = useRef<Record<string, DecisionAttempt | undefined>>({});
  const inFlightAccountsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      setState({ kind: "loading" });

      const nextState = await loadMappingSuggestionsShellState(closingFolderId, activeTenant);

      if (!cancelled) {
        setState(nextState);
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [activeTenant, closingFolderId]);

  async function refreshSuggestionsAfterDecision() {
    const nextState = await loadMappingSuggestionsShellState(closingFolderId, activeTenant);

    if (nextState.kind !== "ready") {
      setState(nextState);
      return false;
    }

    setState(nextState);
    return true;
  }

  function resetDecisionAttempt(accountCode: string) {
    delete decisionAttemptByAccountRef.current[accountCode];
    setDecisionStateByAccount((current) => ({
      ...current,
      [accountCode]: { kind: "idle" }
    }));
  }

  function handleCorrectTargetChange(accountCode: string, targetCode: string) {
    setCorrectTargetByAccount((current) => ({
      ...current,
      [accountCode]: targetCode
    }));
    resetDecisionAttempt(accountCode);
  }

  function handleReviewCommentChange(accountCode: string, reviewComment: string) {
    setReviewCommentByAccount((current) => ({
      ...current,
      [accountCode]: reviewComment
    }));
    resetDecisionAttempt(accountCode);
  }

  async function handleDecision(
    readModel: MappingSuggestionsReadModel,
    suggestion: MappingSuggestion,
    decision: MappingSuggestionDecision
  ) {
    if (inFlightAccountsRef.current.has(suggestion.accountCode)) {
      return;
    }

    const decisionRequest = buildDecisionRequest(
      readModel,
      suggestion,
      decision,
      correctTargetByAccount[suggestion.accountCode] ?? "",
      reviewCommentByAccount[suggestion.accountCode] ?? "",
      selectableTargets
    );

    if (decisionRequest === null) {
      setDecisionStateByAccount((current) => ({
        ...current,
        [suggestion.accountCode]: {
          kind: "bad_request",
          decision
        }
      }));
      delete decisionAttemptByAccountRef.current[suggestion.accountCode];
      return;
    }

    const canonicalPayload = createCanonicalDecisionPayload(suggestion.accountCode, decisionRequest);
    const previousAttempt = decisionAttemptByAccountRef.current[suggestion.accountCode];
    const idempotencyKey =
      previousAttempt?.canonicalPayload === canonicalPayload
        ? previousAttempt.idempotencyKey
        : generateMappingSuggestionDecisionIdempotencyKey();

    decisionAttemptByAccountRef.current[suggestion.accountCode] = {
      canonicalPayload,
      idempotencyKey
    };
    inFlightAccountsRef.current.add(suggestion.accountCode);
    setDecisionStateByAccount((current) => ({
      ...current,
      [suggestion.accountCode]: {
        kind: "submitting",
        decision
      }
    }));

    const result = await recordMappingSuggestionDecision(
      closingFolderId,
      suggestion.accountCode,
      activeTenant,
      idempotencyKey,
      decisionRequest
    );

    inFlightAccountsRef.current.delete(suggestion.accountCode);

    if (result.kind === "success") {
      delete decisionAttemptByAccountRef.current[suggestion.accountCode];
      const refreshSuggestionsSucceeded = await refreshSuggestionsAfterDecision();
      let refreshManualMappingFailed = false;

      if (isManualMappingMutationResult(result.result)) {
        try {
          await onManualMappingMutationConfirmed?.();
        } catch {
          refreshManualMappingFailed = true;
        }
      }

      setDecisionStateByAccount((current) => ({
        ...current,
        [suggestion.accountCode]: {
          kind: "success",
          result: result.result,
          refreshSuggestionsFailed: !refreshSuggestionsSucceeded,
          refreshManualMappingFailed
        }
      }));
      return;
    }

    if (!shouldReuseDecisionAttemptForRetry(result)) {
      delete decisionAttemptByAccountRef.current[suggestion.accountCode];
    }

    setDecisionStateByAccount((current) => ({
      ...current,
      [suggestion.accountCode]: {
        ...result,
        decision
      }
    }));
  }

  return (
    <section aria-labelledby="ai-mapping-suggestion-title" className="rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <p className="label-eyebrow">AI mapping suggestion</p>
          <h4
            className="text-lg font-semibold text-foreground"
            id="ai-mapping-suggestion-title"
          >
            Human decision
          </h4>
          <p className="text-sm text-muted-foreground">
            Human review required. Manual mapping remains the authority.
          </p>
        </div>

        <MappingSuggestionsStateSlot
          decisionStateByAccount={decisionStateByAccount}
          correctTargetByAccount={correctTargetByAccount}
          reviewCommentByAccount={reviewCommentByAccount}
          selectableTargets={selectableTargets}
          state={state}
          onCorrectTargetChange={handleCorrectTargetChange}
          onDecision={handleDecision}
          onReviewCommentChange={handleReviewCommentChange}
        />
      </div>
    </section>
  );
}

function MappingSuggestionsStateSlot({
  state,
  selectableTargets,
  correctTargetByAccount,
  reviewCommentByAccount,
  decisionStateByAccount,
  onCorrectTargetChange,
  onReviewCommentChange,
  onDecision
}: {
  state: MappingSuggestionsShellState;
  selectableTargets: AiMappingSuggestionReviewTarget[];
  correctTargetByAccount: Record<string, string>;
  reviewCommentByAccount: Record<string, string>;
  decisionStateByAccount: Record<string, DecisionReviewState | undefined>;
  onCorrectTargetChange: (accountCode: string, targetCode: string) => void;
  onReviewCommentChange: (accountCode: string, reviewComment: string) => void;
  onDecision: (
    readModel: MappingSuggestionsReadModel,
    suggestion: MappingSuggestion,
    decision: MappingSuggestionDecision
  ) => void;
}) {
  if (state.kind === "loading") {
    return <StateMessage text="loading AI mapping suggestion" />;
  }

  if (state.kind !== "ready") {
    return <StateMessage text={formatShellState(state)} />;
  }

  return (
    <ReadModelView
      correctTargetByAccount={correctTargetByAccount}
      decisionStateByAccount={decisionStateByAccount}
      readModel={state.readModel}
      reviewCommentByAccount={reviewCommentByAccount}
      selectableTargets={selectableTargets}
      onCorrectTargetChange={onCorrectTargetChange}
      onDecision={onDecision}
      onReviewCommentChange={onReviewCommentChange}
    />
  );
}

function ReadModelView({
  readModel,
  selectableTargets,
  correctTargetByAccount,
  reviewCommentByAccount,
  decisionStateByAccount,
  onCorrectTargetChange,
  onReviewCommentChange,
  onDecision
}: {
  readModel: MappingSuggestionsReadModel;
  selectableTargets: AiMappingSuggestionReviewTarget[];
  correctTargetByAccount: Record<string, string>;
  reviewCommentByAccount: Record<string, string>;
  decisionStateByAccount: Record<string, DecisionReviewState | undefined>;
  onCorrectTargetChange: (accountCode: string, targetCode: string) => void;
  onReviewCommentChange: (accountCode: string, reviewComment: string) => void;
  onDecision: (
    readModel: MappingSuggestionsReadModel,
    suggestion: MappingSuggestion,
    decision: MappingSuggestionDecision
  ) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-background/80 p-4">
        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricItem label="state" value={readModel.state} />
          <MetricItem
            label="latest import version"
            value={readModel.latestImportVersion === null ? "none" : String(readModel.latestImportVersion)}
          />
          <MetricItem label="taxonomy version" value={String(readModel.taxonomyVersion)} />
          <MetricItem label="human review" value="Human review required" />
        </dl>
      </div>

      <StateMessage text={stateLabels[readModel.state]} />

      <MappingSuggestionErrors errors={readModel.errors} />

      {readModel.suggestions.length === 0 ? (
        <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
          No AI mapping suggestion prepared.
        </p>
      ) : (
        <ul className="grid gap-4">
          {readModel.suggestions.map((suggestion) => (
            <li key={suggestion.accountCode}>
              <SuggestionCard
                correctTargetCode={correctTargetByAccount[suggestion.accountCode] ?? ""}
                decisionState={decisionStateByAccount[suggestion.accountCode] ?? { kind: "idle" }}
                readModel={readModel}
                reviewComment={reviewCommentByAccount[suggestion.accountCode] ?? ""}
                selectableTargets={selectableTargets}
                suggestion={suggestion}
                onCorrectTargetChange={onCorrectTargetChange}
                onDecision={onDecision}
                onReviewCommentChange={onReviewCommentChange}
              />
            </li>
          ))}
        </ul>
      )}

      <RetainedDecisionStatuses
        decisionStateByAccount={decisionStateByAccount}
        visibleAccountCodes={new Set(readModel.suggestions.map((suggestion) => suggestion.accountCode))}
      />
    </div>
  );
}

function SuggestionCard({
  readModel,
  suggestion,
  selectableTargets,
  correctTargetCode,
  reviewComment,
  decisionState,
  onCorrectTargetChange,
  onReviewCommentChange,
  onDecision
}: {
  readModel: MappingSuggestionsReadModel;
  suggestion: MappingSuggestion;
  selectableTargets: AiMappingSuggestionReviewTarget[];
  correctTargetCode: string;
  reviewComment: string;
  decisionState: DecisionReviewState;
  onCorrectTargetChange: (accountCode: string, targetCode: string) => void;
  onReviewCommentChange: (accountCode: string, reviewComment: string) => void;
  onDecision: (
    readModel: MappingSuggestionsReadModel,
    suggestion: MappingSuggestion,
    decision: MappingSuggestionDecision
  ) => void;
}) {
  const selectableTargetOptions = selectableTargets.filter((target) => target.selectable);
  const selectableTargetCodes = new Set(selectableTargetOptions.map((target) => target.code));
  const decisionable =
    (readModel.state === "READY" || readModel.state === "PARTIAL") &&
    readModel.latestImportVersion !== null;
  const submitting = decisionState.kind === "submitting";
  const normalizedReviewComment = reviewComment.trim();
  const reviewCommentOverLimit = normalizedReviewComment.length > 600;
  const correctTargetSelectable = selectableTargetCodes.has(correctTargetCode);
  const correctTargetDifferent = correctTargetCode !== suggestion.suggestedTargetCode;
  const correctDisabled =
    !decisionable ||
    submitting ||
    reviewCommentOverLimit ||
    correctTargetCode === "" ||
    !correctTargetSelectable ||
    !correctTargetDifferent;
  const primaryDecisionDisabled = !decisionable || submitting || reviewCommentOverLimit;

  return (
    <article
      aria-label={`AI mapping suggestion ${suggestion.accountCode}`}
      className="grid gap-4 rounded-lg border bg-background/80 p-4"
    >
      <div className="grid gap-3">
        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="accountCode" value={suggestion.accountCode} />
          <DetailItem label="accountLabel" value={suggestion.accountLabel} />
          <DetailItem label="suggestedTargetCode" value={suggestion.suggestedTargetCode} />
          <DetailItem label="confidence" value={formatConfidence(suggestion.confidence)} />
          <DetailItem label="riskLevel" value={suggestion.riskLevel} />
          <DetailItem
            label="requiresHumanReview"
            value={suggestion.requiresHumanReview ? "Human review required" : "unavailable"}
          />
        </dl>

        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">rationale courte</p>
          <p className="mt-2 text-sm font-medium text-foreground">{suggestion.rationale}</p>
        </div>
      </div>

      <div className="grid gap-3">
        <h5 className="text-sm font-semibold text-foreground">Evidence</h5>
        <ul className="grid gap-3">
          {suggestion.evidence.map((evidence, index) => (
            <li
              className="rounded-lg border bg-muted/20 p-4 text-sm text-foreground"
              key={`${suggestion.accountCode}-${evidence.type}-${evidence.ref}-${index}`}
            >
              <dl className="grid gap-2">
                <DetailItem label="type" value={evidence.type} />
                <DetailItem label="ref" value={evidence.ref} />
                <DetailItem label="snippet" value={evidence.snippet} />
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
        <div className="grid gap-2">
          <h5 className="text-sm font-semibold text-foreground">Human decision</h5>
          <p className="text-sm text-muted-foreground">
            Human review required. Manual mapping remains the authority.
          </p>
        </div>

        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor={`ai-review-comment-${suggestion.accountCode}`}
          >
            Human decision reviewComment
          </label>
          <textarea
            className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted"
            disabled={submitting}
            id={`ai-review-comment-${suggestion.accountCode}`}
            maxLength={600}
            onChange={(event) => {
              onReviewCommentChange(suggestion.accountCode, event.currentTarget.value);
            }}
            value={reviewComment}
          />
          <p className="text-sm text-muted-foreground">
            {normalizedReviewComment.length}/600
          </p>
          {reviewCommentOverLimit ? (
            <p className="text-sm font-medium text-[hsl(var(--error-default))]">
              Human decision reviewComment is limited to 600 characters.
            </p>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-end">
          <div className="grid gap-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={`ai-correction-target-${suggestion.accountCode}`}
            >
              Correct with another target
            </label>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
              disabled={!decisionable || submitting}
              id={`ai-correction-target-${suggestion.accountCode}`}
              onChange={(event) => {
                onCorrectTargetChange(suggestion.accountCode, event.currentTarget.value);
              }}
              value={correctTargetCode}
            >
              <option value="">Correct with another target</option>
              {selectableTargetOptions.map((target) => (
                <option key={target.code} value={target.code}>
                  {formatTargetOption(target)}
                </option>
              ))}
            </select>
            {correctTargetCode === suggestion.suggestedTargetCode ? (
              <p className="text-sm font-medium text-foreground">
                Correct with another target must differ from suggestedTargetCode.
              </p>
            ) : null}
          </div>

          <Button
            disabled={primaryDecisionDisabled}
            onClick={() => {
              onDecision(readModel, suggestion, "ACCEPT");
            }}
            type="button"
          >
            Accept suggestion
          </Button>

          <Button
            disabled={correctDisabled}
            onClick={() => {
              onDecision(readModel, suggestion, "CORRECT");
            }}
            type="button"
            variant="outline"
          >
            Correct with another target
          </Button>

          <Button
            disabled={primaryDecisionDisabled}
            onClick={() => {
              onDecision(readModel, suggestion, "REJECT");
            }}
            type="button"
            variant="outline"
          >
            Reject suggestion
          </Button>
        </div>

        {!decisionable ? (
          <p className="text-sm font-medium text-foreground">Human review required.</p>
        ) : null}

        <DecisionStatus state={decisionState} />
      </div>
    </article>
  );
}

function MappingSuggestionErrors({ errors }: { errors: MappingSuggestionError[] }) {
  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <h5 className="text-sm font-semibold text-foreground">Read-model messages</h5>
      <ul className="grid gap-3">
        {errors.map((error, index) => (
          <li
            className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground"
            key={`${error.code}-${index}`}
          >
            {error.code}: {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return <DetailItem label={label} value={value} />;
}

function StateMessage({ text }: { text: string }) {
  return (
    <div aria-live="polite" className="grid gap-2">
      <p className="label-eyebrow">Visible state</p>
      <p className="text-lg font-semibold text-foreground">{text}</p>
    </div>
  );
}

function DecisionStatus({ state }: { state: DecisionReviewState }) {
  if (state.kind === "idle") {
    return null;
  }

  if (state.kind === "submitting") {
    return (
      <p aria-live="polite" className="text-sm font-medium text-foreground">
        Human decision in progress: {state.decision}.
      </p>
    );
  }

  if (state.kind === "success") {
    return (
      <div aria-live="polite" className="grid gap-2 text-sm font-medium text-foreground">
        <p>
          Human decision recorded: {state.result.decision}. resultKind:{" "}
          {state.result.resultKind}.
        </p>
        {state.refreshSuggestionsFailed ? <p>AI mapping suggestion refresh failed.</p> : null}
        {state.refreshManualMappingFailed ? (
          <p>Manual mapping remains the authority. Refresh failed.</p>
        ) : null}
      </div>
    );
  }

  return (
    <p aria-live="polite" className="text-sm font-medium text-foreground">
      {formatDecisionState(state)}
    </p>
  );
}

function RetainedDecisionStatuses({
  decisionStateByAccount,
  visibleAccountCodes
}: {
  decisionStateByAccount: Record<string, DecisionReviewState | undefined>;
  visibleAccountCodes: Set<string>;
}) {
  const retainedStates: Array<[string, DecisionReviewState]> = [];

  Object.entries(decisionStateByAccount).forEach(([accountCode, state]) => {
    if (state !== undefined && state.kind !== "idle" && !visibleAccountCodes.has(accountCode)) {
      retainedStates.push([accountCode, state]);
    }
  });

  if (retainedStates.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-background/80 p-4">
      <h5 className="text-sm font-semibold text-foreground">Human decision</h5>
      {retainedStates.map(([accountCode, state]) => (
        <div className="grid gap-1" key={accountCode}>
          <p className="text-sm text-muted-foreground">accountCode {accountCode}</p>
          <DecisionStatus state={state} />
        </div>
      ))}
    </div>
  );
}

function formatShellState(
  state: Exclude<MappingSuggestionsShellState, { kind: "loading" | "ready" }>
) {
  if (state.kind === "auth_required") {
    return "authentication required";
  }

  if (state.kind === "forbidden") {
    return "AI mapping suggestion access refused";
  }

  if (state.kind === "not_found") {
    return "AI mapping suggestion closing folder unavailable";
  }

  if (state.kind === "network_error") {
    return "AI mapping suggestion network error";
  }

  if (state.kind === "timeout") {
    return "AI mapping suggestion timeout";
  }

  return "AI mapping suggestion unavailable.";
}

function formatDecisionState(
  state: Exclude<DecisionReviewState, { kind: "idle" | "submitting" | "success" }>
) {
  if (state.kind === "bad_request") {
    return "Human decision invalid payload.";
  }

  if (state.kind === "auth_required") {
    return "Human decision authentication required.";
  }

  if (state.kind === "forbidden") {
    return "Human decision forbidden.";
  }

  if (state.kind === "not_found") {
    return "Human decision suggestion not found.";
  }

  if (state.kind === "conflict") {
    return state.result === null
      ? "Human decision conflict: suggestion changed or no longer decisionable."
      : `Human decision conflict: ${state.result.resultKind}.`;
  }

  if (state.kind === "server_error") {
    return "Human decision server error.";
  }

  if (state.kind === "network_error") {
    return "Human decision network error.";
  }

  if (state.kind === "timeout") {
    return "Human decision timeout.";
  }

  if (state.kind === "invalid_payload") {
    return "Human decision invalid response payload.";
  }

  return "Human decision unavailable.";
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)} %`;
}

function buildDecisionRequest(
  readModel: MappingSuggestionsReadModel,
  suggestion: MappingSuggestion,
  decision: MappingSuggestionDecision,
  correctTargetCode: string,
  reviewComment: string,
  selectableTargets: AiMappingSuggestionReviewTarget[]
): MappingSuggestionDecisionRequest | null {
  if (
    readModel.latestImportVersion === null ||
    !["READY", "PARTIAL"].includes(readModel.state)
  ) {
    return null;
  }

  const trimmedComment = reviewComment.trim();

  if (trimmedComment.length > 600) {
    return null;
  }

  const base = {
    latestImportVersion: readModel.latestImportVersion,
    suggestionFingerprint: suggestion.suggestionFingerprint,
    ...(trimmedComment.length === 0 ? {} : { reviewComment: trimmedComment })
  };

  if (decision === "ACCEPT") {
    return {
      ...base,
      decision,
      targetCode: suggestion.suggestedTargetCode
    };
  }

  if (decision === "REJECT") {
    return {
      ...base,
      decision
    };
  }

  const selectableTargetCodes = new Set(
    selectableTargets.filter((target) => target.selectable).map((target) => target.code)
  );

  if (
    correctTargetCode === "" ||
    correctTargetCode === suggestion.suggestedTargetCode ||
    !selectableTargetCodes.has(correctTargetCode)
  ) {
    return null;
  }

  return {
    ...base,
    decision,
    targetCode: correctTargetCode
  };
}

function createCanonicalDecisionPayload(
  accountCode: string,
  decisionRequest: MappingSuggestionDecisionRequest
) {
  return JSON.stringify({
    accountCode,
    decision: decisionRequest.decision,
    latestImportVersion: decisionRequest.latestImportVersion,
    suggestionFingerprint: decisionRequest.suggestionFingerprint,
    targetCode: "targetCode" in decisionRequest ? decisionRequest.targetCode : null,
    reviewComment: decisionRequest.reviewComment?.trim() ?? null
  });
}

function shouldReuseDecisionAttemptForRetry(
  result: Exclude<MappingSuggestionDecisionState, { kind: "success" }>
) {
  return (
    result.kind === "network_error" ||
    result.kind === "timeout" ||
    result.kind === "server_error"
  );
}

function isManualMappingMutationResult(result: MappingSuggestionDecisionResult) {
  return (
    result.resultKind === "MANUAL_MAPPING_CREATED" ||
    result.resultKind === "MANUAL_MAPPING_UPDATED"
  );
}

function formatTargetOption(target: AiMappingSuggestionReviewTarget) {
  return `${target.label} (${target.code})`;
}
