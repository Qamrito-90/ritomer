@org.springframework.modulith.ApplicationModule(
    displayName = "Exports",
    allowedDependencies = {
        "shared::application",
        "identity::access",
        "closing::access",
        "controls::access",
        "financials::access",
        "workpapers::access"
    }
)
package ch.qamwaq.ritomer.exports;
