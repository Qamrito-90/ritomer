import { describe, expect, it } from "vitest";
import { isMappingSuggestionsV2LocalSimulationEnabled } from "./local-feature-flags";

describe("local feature flags", () => {
  it("keeps mapping suggestions v2 local simulation disabled by default", () => {
    expect(isMappingSuggestionsV2LocalSimulationEnabled({ DEV: true })).toBe(false);
    expect(
      isMappingSuggestionsV2LocalSimulationEnabled({
        DEV: true,
        VITE_RITOMER_MAPPING_SUGGESTIONS_V2_LOCAL_SIMULATION: "false"
      })
    ).toBe(false);
  });

  it("ignores the mapping suggestions v2 local simulation flag outside DEV", () => {
    expect(
      isMappingSuggestionsV2LocalSimulationEnabled({
        DEV: false,
        VITE_RITOMER_MAPPING_SUGGESTIONS_V2_LOCAL_SIMULATION: "true"
      })
    ).toBe(false);
  });

  it("enables mapping suggestions v2 local simulation only in DEV with the explicit true flag", () => {
    expect(
      isMappingSuggestionsV2LocalSimulationEnabled({
        DEV: true,
        VITE_RITOMER_MAPPING_SUGGESTIONS_V2_LOCAL_SIMULATION: "true"
      })
    ).toBe(true);
  });
});
