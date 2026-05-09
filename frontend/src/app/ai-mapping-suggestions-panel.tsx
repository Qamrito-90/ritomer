import { useEffect, useState } from "react";
import type {
  MappingSuggestion,
  MappingSuggestionError,
  MappingSuggestionsReadModel,
  MappingSuggestionsShellState,
  MappingSuggestionsState
} from "../lib/api/mapping-suggestions";
import { loadMappingSuggestionsShellState } from "../lib/api/mapping-suggestions";
import type { ActiveTenant } from "../lib/api/me";

type AiMappingSuggestionsPanelProps = {
  activeTenant: ActiveTenant;
  closingFolderId: string;
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

export function AiMappingSuggestionsPanel({
  activeTenant,
  closingFolderId
}: AiMappingSuggestionsPanelProps) {
  const [state, setState] = useState<MappingSuggestionsShellState>({ kind: "loading" });

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

  return (
    <section aria-labelledby="ai-mapping-suggestion-title" className="rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <p className="label-eyebrow">AI mapping suggestion</p>
          <h4
            className="text-lg font-semibold text-foreground"
            id="ai-mapping-suggestion-title"
          >
            Read-only suggestion
          </h4>
          <p className="text-sm text-muted-foreground">
            Prepared for human review. Human review required. Manual mapping remains the
            authority.
          </p>
        </div>

        <MappingSuggestionsStateSlot state={state} />
      </div>
    </section>
  );
}

function MappingSuggestionsStateSlot({ state }: { state: MappingSuggestionsShellState }) {
  if (state.kind === "loading") {
    return <StateMessage text="loading AI mapping suggestion" />;
  }

  if (state.kind !== "ready") {
    return <StateMessage text={formatShellState(state)} />;
  }

  return <ReadModelView readModel={state.readModel} />;
}

function ReadModelView({ readModel }: { readModel: MappingSuggestionsReadModel }) {
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
              <SuggestionCard suggestion={suggestion} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SuggestionCard({ suggestion }: { suggestion: MappingSuggestion }) {
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

function formatConfidence(confidence: number) {
  return `${Math.round(confidence * 100)} %`;
}
