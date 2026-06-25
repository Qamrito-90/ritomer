type MappingSuggestionsV2LocalSimulationEnv = {
  readonly DEV?: boolean;
  readonly VITE_RITOMER_MAPPING_SUGGESTIONS_V2_LOCAL_SIMULATION?: string;
};

export function isMappingSuggestionsV2LocalSimulationEnabled(
  environment: MappingSuggestionsV2LocalSimulationEnv = import.meta.env
) {
  return (
    environment.DEV === true &&
    environment.VITE_RITOMER_MAPPING_SUGGESTIONS_V2_LOCAL_SIMULATION === "true"
  );
}
