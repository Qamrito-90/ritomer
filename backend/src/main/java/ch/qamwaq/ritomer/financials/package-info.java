@org.springframework.modulith.ApplicationModule(
    displayName = "Financials",
    allowedDependencies = {"shared::application", "identity::access", "closing::access", "mapping::access", "controls::access"}
)
package ch.qamwaq.ritomer.financials;
