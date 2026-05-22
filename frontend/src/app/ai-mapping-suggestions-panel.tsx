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
  DISABLED: "Suggestions IA desactivees.",
  NO_IMPORT: "Import balance requis pour les suggestions IA.",
  READY: "Suggestions IA disponibles.",
  PARTIAL: "Couverture partielle des suggestions IA.",
  ARCHIVED_READ_ONLY: "Dossier archive, suggestions en lecture seule.",
  UNAVAILABLE: "Suggestions IA indisponibles.",
  TIMEOUT: "Timeout suggestions IA.",
  INVALID_MODEL_OUTPUT: "Sortie IA indisponible pour revue.",
  INSUFFICIENT_EVIDENCE: "Preuves insuffisantes pour suggestions IA."
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
          <p className="label-eyebrow">Suggestion IA de mapping</p>
          <h4
            className="text-lg font-semibold text-foreground"
            id="ai-mapping-suggestion-title"
          >
            Decision humaine
          </h4>
          <p className="text-sm text-muted-foreground">
            Revue humaine requise. Le mapping manuel reste la reference.
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
    return <StateMessage text="chargement suggestion IA de mapping" />;
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
          <MetricItem label="etat" value={readModel.state} />
          <MetricItem
            label="derniere version import"
            value={readModel.latestImportVersion === null ? "aucune" : String(readModel.latestImportVersion)}
          />
          <MetricItem label="version taxonomie" value={String(readModel.taxonomyVersion)} />
          <MetricItem label="revue humaine" value="requise" />
        </dl>
      </div>

      <StateMessage text={stateLabels[readModel.state]} />

      <MappingSuggestionErrors errors={readModel.errors} />

      {readModel.suggestions.length === 0 ? (
        <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
          Aucune suggestion IA preparee.
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
      aria-label={`suggestion IA mapping ${suggestion.accountCode}`}
      className="grid min-w-0 gap-4 overflow-hidden rounded-lg border bg-background/80 p-4"
    >
      <div className="grid gap-3">
        <dl className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="compte" value={suggestion.accountCode} />
          <DetailItem label="libelle compte" value={suggestion.accountLabel} />
          <DetailItem label="cible suggeree" value={suggestion.suggestedTargetCode} />
          <DetailItem label="confiance" value={formatConfidence(suggestion.confidence)} />
          <DetailItem label="niveau de risque" value={suggestion.riskLevel} />
          <DetailItem
            label="revue humaine"
            value={suggestion.requiresHumanReview ? "requise" : "indisponible"}
          />
        </dl>

        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="text-sm text-muted-foreground">rationale courte</p>
          <p className="mt-2 text-sm font-medium text-foreground">{suggestion.rationale}</p>
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
                <DetailItem label="type" value={evidence.type} />
                <DetailItem label="reference" value={evidence.ref} />
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
            Revue humaine requise. Le mapping manuel reste la reference.
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
            Accepter la suggestion
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
            Corriger la cible
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
            Rejeter la suggestion
          </Button>
        </div>

        {!decisionable ? (
          <p className="text-sm font-medium text-foreground">Revue humaine requise.</p>
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
      <h5 className="text-sm font-semibold text-foreground">Messages de lecture</h5>
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
      <p className="label-eyebrow">Etat visible</p>
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
        Decision humaine en cours : {state.decision}.
      </p>
    );
  }

  if (state.kind === "success") {
    return (
      <div aria-live="polite" className="grid gap-2 text-sm font-medium text-foreground">
        <p>
          Decision humaine enregistree : {state.result.decision}. resultat :{" "}
          {state.result.resultKind}.
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
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces suggestion IA refuse";
  }

  if (state.kind === "not_found") {
    return "dossier indisponible pour suggestion IA";
  }

  if (state.kind === "network_error") {
    return "erreur reseau suggestion IA";
  }

  if (state.kind === "timeout") {
    return "timeout suggestion IA";
  }

  return "suggestion IA indisponible.";
}

function formatDecisionState(
  state: Exclude<DecisionReviewState, { kind: "idle" | "submitting" | "success" }>
) {
  if (state.kind === "bad_request") {
    return "decision humaine invalide.";
  }

  if (state.kind === "auth_required") {
    return "authentification requise pour decision humaine.";
  }

  if (state.kind === "forbidden") {
    return "decision humaine refusee.";
  }

  if (state.kind === "not_found") {
    return "suggestion introuvable pour decision humaine.";
  }

  if (state.kind === "conflict") {
    return state.result === null
      ? "Conflit de decision humaine : suggestion modifiee ou plus disponible pour decision."
      : `Conflit de decision humaine : ${state.result.resultKind}.`;
  }

  if (state.kind === "server_error") {
    return "erreur serveur decision humaine.";
  }

  if (state.kind === "network_error") {
    return "erreur reseau decision humaine.";
  }

  if (state.kind === "timeout") {
    return "timeout decision humaine.";
  }

  if (state.kind === "invalid_payload") {
    return "reponse decision humaine invalide.";
  }

  return "decision humaine indisponible.";
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
