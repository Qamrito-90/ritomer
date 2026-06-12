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
  suggestionsRefreshRequestId?: number;
  onManualMappingMutationConfirmed?: () =>
    | Promise<ManualMappingRefreshWarnings | void>
    | ManualMappingRefreshWarnings
    | void;
  onSuggestionsRefreshSettled?: (requestId: number, succeeded: boolean) => void;
};

export type ManualMappingRefreshWarnings = {
  mappingFailed?: boolean;
  controlsFailed?: boolean;
  financialSummaryFailed?: boolean;
  financialStatementsFailed?: boolean;
  workpapersFailed?: boolean;
  suggestionsFailed?: boolean;
};

const stateLabels: Record<MappingSuggestionsState, string> = {
  DISABLED:
    "Suggestions desactivees pour cette demo locale. Aucune suggestion n'est generee. Continuez avec le mapping manuel.",
  NO_IMPORT:
    "Import balance requis avant une aide de mapping. Le mapping manuel reste disponible.",
  READY: "Suggestions pretes pour revue humaine. Aucune decision automatique.",
  PARTIAL:
    "Suggestions partielles a revoir. Le mapping manuel reste la reference.",
  ARCHIVED_READ_ONLY:
    "Dossier archive : suggestions consultables uniquement. Aucune decision automatique.",
  UNAVAILABLE:
    "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.",
  TIMEOUT:
    "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.",
  INVALID_MODEL_OUTPUT:
    "Suggestions non exploitables pour le moment. Le mapping manuel reste utilisable.",
  INSUFFICIENT_EVIDENCE:
    "Preuves insuffisantes pour preparer des suggestions. Continuez avec le mapping manuel."
};

type DecisionReviewState =
  | { kind: "idle" }
  | { kind: "submitting"; decision: MappingSuggestionDecision }
  | {
      kind: "success";
      result: MappingSuggestionDecisionResult;
      refreshSuggestionsFailed: boolean;
      manualMappingRefreshWarnings: ManualMappingRefreshWarnings;
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
  suggestionsRefreshRequestId = 0,
  onManualMappingMutationConfirmed,
  onSuggestionsRefreshSettled
}: AiMappingSuggestionsPanelProps) {
  const [state, setState] = useState<MappingSuggestionsShellState>({ kind: "loading" });
  const [correctTargetByAccount, setCorrectTargetByAccount] = useState<Record<string, string>>({});
  const [reviewCommentByAccount, setReviewCommentByAccount] = useState<Record<string, string>>({});
  const [decisionStateByAccount, setDecisionStateByAccount] = useState<
    Record<string, DecisionReviewState | undefined>
  >({});
  const decisionAttemptByAccountRef = useRef<Record<string, DecisionAttempt | undefined>>({});
  const inFlightAccountsRef = useRef<Set<string>>(new Set());
  const hasLoadedSuggestionsRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSuggestions() {
      const isInitialLoad = !hasLoadedSuggestionsRef.current;

      if (isInitialLoad) {
        setState({ kind: "loading" });
      }

      const nextState = await loadMappingSuggestionsShellState(closingFolderId, activeTenant);

      if (cancelled) {
        return;
      }

      if (isInitialLoad || nextState.kind === "ready") {
        setState(nextState);
      }

      hasLoadedSuggestionsRef.current = true;

      if (!isInitialLoad && suggestionsRefreshRequestId > 0) {
        onSuggestionsRefreshSettled?.(suggestionsRefreshRequestId, nextState.kind === "ready");
      }
    }

    void loadSuggestions();

    return () => {
      cancelled = true;
    };
  }, [activeTenant, closingFolderId, onSuggestionsRefreshSettled, suggestionsRefreshRequestId]);

  async function refreshSuggestionsAfterDecision() {
    const nextState = await loadMappingSuggestionsShellState(closingFolderId, activeTenant);

    if (nextState.kind !== "ready") {
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
      let manualMappingRefreshWarnings: ManualMappingRefreshWarnings = {};

      if (isManualMappingMutationResult(result.result)) {
        try {
          manualMappingRefreshWarnings = (await onManualMappingMutationConfirmed?.()) ?? {};
        } catch {
          manualMappingRefreshWarnings = { mappingFailed: true };
        }
      }

      setDecisionStateByAccount((current) => ({
        ...current,
        [suggestion.accountCode]: {
          kind: "success",
          result: result.result,
          refreshSuggestionsFailed: !refreshSuggestionsSucceeded,
          manualMappingRefreshWarnings
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
          <p className="label-eyebrow">Aide locale a la revue</p>
          <h4
            className="text-lg font-semibold text-foreground"
            id="ai-mapping-suggestion-title"
          >
            Suggestions de mapping a revoir
          </h4>
          <p className="text-sm text-muted-foreground">
            Aucune IA reelle n'est active. Aucun service IA externe n'est appele. Le mapping manuel reste la reference.
          </p>
          <p className="text-sm font-medium text-foreground">
            Revue humaine obligatoire. Aucune decision automatique.
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
    return <StateMessage text="Chargement des suggestions de mapping." />;
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
  const suggestionsCount = readModel.suggestions.length;

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-background/80 p-4">
        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricItem label="suggestions a revoir" value={formatSuggestionCount(suggestionsCount)} />
          <MetricItem
            label="import courant"
            value={readModel.latestImportVersion === null ? "aucune" : String(readModel.latestImportVersion)}
          />
          <MetricItem label="autorite metier" value="mapping manuel" />
          <MetricItem label="revue humaine" value="obligatoire" />
        </dl>
      </div>

      <StateMessage text={stateLabels[readModel.state]} />

      <MappingSuggestionErrors errors={readModel.errors} />

      {readModel.suggestions.length === 0 ? (
        <div className="grid gap-2 rounded-lg border bg-background/80 p-4">
          <p className="text-sm font-semibold text-foreground">Aucune suggestion a revoir</p>
          <p className="text-sm text-muted-foreground">
            Aucune suggestion n'est generee. Le mapping manuel reste disponible et fait reference pour cette demo.
          </p>
        </div>
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
      aria-label={`suggestion mapping ${suggestion.accountCode} a revoir`}
      className="grid min-w-0 gap-4 overflow-hidden rounded-lg border bg-background/80 p-4"
    >
      <div className="grid gap-3">
        <dl className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="compte" value={suggestion.accountCode} />
          <DetailItem label="libelle compte" value={suggestion.accountLabel} />
          <DetailItem label="cible suggeree" value={suggestion.suggestedTargetCode} />
          <DetailItem label="confiance" value={formatConfidence(suggestion.confidence)} />
          <DetailItem
            label="revue humaine"
            value={suggestion.requiresHumanReview ? "obligatoire" : "indisponible"}
          />
        </dl>

        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">Raison de suggestion</p>
          <p className="mt-2 text-sm font-medium text-foreground">
            Proposition a verifier avec les preuves ci-dessous avant toute decision humaine.
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <h5 className="text-sm font-semibold text-foreground">Preuves</h5>
        <ul className="grid gap-3">
          {suggestion.evidence.map((evidence, index) => (
            <li
              className="rounded-lg border bg-muted/20 p-4 text-sm text-foreground"
              key={`${suggestion.accountCode}-${evidence.type}-${evidence.ref}-${index}`}
            >
              <dl className="grid gap-2">
                <DetailItem label="source" value={formatEvidenceType(evidence.type)} />
                <DetailItem label="repere" value={formatEvidenceReference(evidence)} />
                <DetailItem label="extrait" value={evidence.snippet} />
              </dl>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 rounded-lg border bg-muted/20 p-4">
        <div className="grid gap-2">
          <h5 className="text-sm font-semibold text-foreground">Decision humaine</h5>
          <p className="text-sm text-muted-foreground">
            Revue humaine obligatoire. Le mapping manuel reste la reference.
          </p>
        </div>

        <div className="grid gap-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor={`ai-review-comment-${suggestion.accountCode}`}
          >
            Commentaire de revue
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
              Commentaire de revue limite a 600 caracteres.
            </p>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(8rem,auto)_minmax(11rem,auto)_minmax(8rem,auto)] xl:items-end">
          <div className="grid min-w-0 gap-2">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor={`ai-correction-target-${suggestion.accountCode}`}
            >
              Corriger avec une autre cible
            </label>
            <select
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
              disabled={!decisionable || submitting}
              id={`ai-correction-target-${suggestion.accountCode}`}
              onChange={(event) => {
                onCorrectTargetChange(suggestion.accountCode, event.currentTarget.value);
              }}
              value={correctTargetCode}
            >
              <option value="">Corriger avec une autre cible</option>
              {selectableTargetOptions.map((target) => (
                <option key={target.code} value={target.code}>
                  {formatTargetOption(target)}
                </option>
              ))}
            </select>
            {correctTargetCode === suggestion.suggestedTargetCode ? (
              <p className="text-sm font-medium text-foreground">
                La cible corrigee doit differer de la cible suggeree.
              </p>
            ) : null}
          </div>

          <Button
            className="w-full xl:w-auto"
            disabled={primaryDecisionDisabled}
            onClick={() => {
              onDecision(readModel, suggestion, "ACCEPT");
            }}
            type="button"
          >
            Accepter
          </Button>

          <Button
            className="w-full xl:w-auto"
            disabled={correctDisabled}
            onClick={() => {
              onDecision(readModel, suggestion, "CORRECT");
            }}
            type="button"
            variant="outline"
          >
            Corriger
          </Button>

          <Button
            className="w-full xl:w-auto"
            disabled={primaryDecisionDisabled}
            onClick={() => {
              onDecision(readModel, suggestion, "REJECT");
            }}
            type="button"
            variant="outline"
          >
            Rejeter
          </Button>
        </div>

        {!decisionable ? (
          <p className="text-sm font-medium text-foreground">Revue humaine obligatoire.</p>
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
      <h5 className="text-sm font-semibold text-foreground">Points de revue</h5>
      <ul className="grid gap-3">
        {errors.map((error, index) => (
          <li
            className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground"
            key={`${error.code}-${index}`}
          >
            {formatMappingSuggestionError(error)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 min-w-0 break-words text-sm font-medium tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return <DetailItem label={label} value={value} />;
}

function StateMessage({ text }: { text: string }) {
  return (
    <div aria-live="polite" className="grid gap-2">
      <p className="label-eyebrow">Statut de revue</p>
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
        Decision humaine en cours : {formatDecisionLabel(state.decision)}.
      </p>
    );
  }

  if (state.kind === "success") {
    return (
      <div aria-live="polite" className="grid gap-2 text-sm font-medium text-foreground">
        <p>
          Decision humaine enregistree : {formatDecisionLabel(state.result.decision)}.{" "}
          {formatDecisionResultKind(state.result.resultKind)}.
        </p>
        {state.refreshSuggestionsFailed ? <p>rafraichissement suggestions impossible</p> : null}
        {state.manualMappingRefreshWarnings.mappingFailed ? (
          <p>rafraichissement mapping impossible</p>
        ) : null}
        {state.manualMappingRefreshWarnings.controlsFailed ? (
          <p>rafraichissement controles impossible</p>
        ) : null}
        {state.manualMappingRefreshWarnings.financialSummaryFailed ? (
          <p>rafraichissement synthese financiere impossible</p>
        ) : null}
        {state.manualMappingRefreshWarnings.financialStatementsFailed ? (
          <p>rafraichissement etats financiers impossible</p>
        ) : null}
        {state.manualMappingRefreshWarnings.workpapersFailed ? (
          <p>rafraichissement justifications impossible</p>
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
      <h5 className="text-sm font-semibold text-foreground">Decision humaine</h5>
      {retainedStates.map(([accountCode, state]) => (
        <div className="grid gap-1" key={accountCode}>
          <p className="text-sm text-muted-foreground">compte {accountCode}</p>
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
    return "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.";
  }

  if (state.kind === "forbidden") {
    return "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.";
  }

  if (state.kind === "not_found") {
    return "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.";
  }

  if (state.kind === "network_error") {
    return "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.";
  }

  if (state.kind === "timeout") {
    return "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.";
  }

  return "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.";
}

function formatDecisionState(
  state: Exclude<DecisionReviewState, { kind: "idle" | "submitting" | "success" }>
) {
  if (state.kind === "bad_request") {
    return "Decision humaine impossible avec ces informations.";
  }

  if (state.kind === "auth_required") {
    return "Decision humaine indisponible pour le moment. Continuez avec le mapping manuel.";
  }

  if (state.kind === "forbidden") {
    return "Decision humaine indisponible pour le moment. Continuez avec le mapping manuel.";
  }

  if (state.kind === "not_found") {
    return "Suggestion indisponible pour cette decision. Continuez avec le mapping manuel.";
  }

  if (state.kind === "conflict") {
    return state.result === null
      ? "Suggestion modifiee ou plus disponible pour decision. Relisez le mapping manuel avant de continuer."
      : formatDecisionResultKind(state.result.resultKind);
  }

  if (state.kind === "server_error") {
    return "Decision humaine indisponible pour le moment. Reessayez ou continuez avec le mapping manuel.";
  }

  if (state.kind === "network_error") {
    return "Decision humaine indisponible pour le moment. Reessayez ou continuez avec le mapping manuel.";
  }

  if (state.kind === "timeout") {
    return "Decision humaine indisponible pour le moment. Reessayez ou continuez avec le mapping manuel.";
  }

  if (state.kind === "invalid_payload") {
    return "Decision humaine bloquee par securite. Continuez avec le mapping manuel.";
  }

  return "Decision humaine indisponible pour le moment. Continuez avec le mapping manuel.";
}

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)} %`;
}

function formatSuggestionCount(count: number) {
  if (count === 0) {
    return "aucune";
  }

  if (count === 1) {
    return "1 suggestion";
  }

  return `${count} suggestions`;
}

function formatEvidenceType(type: MappingSuggestion["evidence"][number]["type"]) {
  if (type === "ACCOUNT_LABEL") {
    return "Libelle du compte";
  }

  if (type === "BALANCE_IMPORT_LINE") {
    return "Ligne de balance";
  }

  if (type === "TARGET_TAXONOMY") {
    return "Taxonomie de mapping";
  }

  if (type === "HISTORICAL_MAPPING") {
    return "Mapping historique";
  }

  if (type === "RULE_DOC") {
    return "Regle documentee";
  }

  return "Modele de note";
}

function formatEvidenceReference(evidence: MappingSuggestion["evidence"][number]) {
  if (
    evidence.type === "ACCOUNT_LABEL" ||
    evidence.type === "BALANCE_IMPORT_LINE"
  ) {
    const lineRef = getLastReferenceSegment(evidence.ref);
    return lineRef === undefined || lineRef.length === 0
      ? "ligne de balance"
      : `ligne de balance ${lineRef}`;
  }

  if (evidence.type === "TARGET_TAXONOMY") {
    const targetCode = getLastReferenceSegment(evidence.ref);
    return targetCode === undefined || targetCode.length === 0
      ? "cible de mapping"
      : `cible ${targetCode}`;
  }

  return "preuve rattachee";
}

function getLastReferenceSegment(reference: string) {
  const segments = reference.split(":");
  return segments[segments.length - 1];
}

function formatMappingSuggestionError(error: MappingSuggestionError) {
  if (error.code === "AI_MAPPING_SUGGESTIONS_DISABLED") {
    return "Suggestions desactivees pour cette demo locale. Continuez avec le mapping manuel.";
  }

  if (error.code === "NO_LATEST_IMPORT") {
    return "Import balance requis avant de preparer des suggestions. Le mapping manuel reste disponible.";
  }

  if (error.code === "PARTIAL_SUGGESTIONS") {
    return "Certaines lignes n'ont pas assez de preuves pour une suggestion. Revoyez-les dans le mapping manuel.";
  }

  if (error.code === "INSUFFICIENT_EVIDENCE") {
    return "Preuves insuffisantes pour preparer des suggestions. Continuez avec le mapping manuel.";
  }

  if (error.code === "ARCHIVED_READ_ONLY") {
    return "Dossier archive : lecture seule. Aucune decision automatique.";
  }

  return "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.";
}

function formatDecisionLabel(decision: MappingSuggestionDecision) {
  if (decision === "ACCEPT") {
    return "accepter";
  }

  if (decision === "CORRECT") {
    return "corriger";
  }

  return "rejeter";
}

function formatDecisionResultKind(resultKind: MappingSuggestionDecisionResult["resultKind"]) {
  if (resultKind === "MANUAL_MAPPING_CREATED") {
    return "Mapping manuel cree apres validation humaine";
  }

  if (resultKind === "MANUAL_MAPPING_UPDATED") {
    return "Mapping manuel mis a jour apres validation humaine";
  }

  if (resultKind === "MANUAL_MAPPING_NOOP") {
    return "Aucun changement de mapping manuel necessaire";
  }

  if (resultKind === "REJECT_RECORDED") {
    return "Rejet enregistre pour revue";
  }

  if (resultKind === "CONFLICT_ARCHIVED") {
    return "Dossier archive : decision non appliquee";
  }

  if (resultKind === "CONFLICT_NO_IMPORT") {
    return "Import courant requis avant decision";
  }

  if (resultKind === "CONFLICT_FLAG_OFF") {
    return "Suggestions desactivees pour cette demo locale";
  }

  if (resultKind === "CONFLICT_NON_DECISIONABLE") {
    return "Suggestion non disponible pour decision";
  }

  if (resultKind === "CONFLICT_SUGGESTION_ABSENT") {
    return "Suggestion absente de la derniere lecture";
  }

  if (resultKind === "CONFLICT_FINGERPRINT_MISMATCH") {
    return "Suggestion modifiee depuis la derniere lecture";
  }

  if (resultKind === "CONFLICT_STALE_IMPORT") {
    return "Import plus recent detecte avant decision";
  }

  if (resultKind === "CONFLICT_ACCOUNT_ABSENT") {
    return "Compte absent du dernier import";
  }

  if (resultKind === "CONFLICT_TARGET_MISMATCH") {
    return "Cible de mapping incoherente avec la suggestion";
  }

  return "Cible non selectionnable pour le mapping manuel";
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
