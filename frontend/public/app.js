const backendUrl = window.APP_CONFIG?.backendUrl ?? "http://localhost:3001";

const elements = {
  backendPort: document.querySelector("#backendPort"),
  backendState: document.querySelector("#backendState"),
  backendUrl: document.querySelector("#backendUrl"),
  checkedAt: document.querySelector("#checkedAt"),
  messageBody: document.querySelector("#messageBody"),
  messageTitle: document.querySelector("#messageTitle"),
  refreshButton: document.querySelector("#refreshButton"),
  statusBadge: document.querySelector("#statusBadge")
};

const formatter = new Intl.DateTimeFormat("fr-CH", {
  dateStyle: "medium",
  timeStyle: "medium"
});

function setBadge(label, tone) {
  elements.statusBadge.textContent = label;
  elements.statusBadge.className = `status-badge ${tone}`;
}

function setCheckingState() {
  setBadge("Verification...", "pending");
  elements.backendState.textContent = "Connexion en cours";
  elements.messageTitle.textContent = "Verification du backend";
  elements.messageBody.textContent = "Tentative de connexion a l'API locale.";
}

async function loadBackendStatus() {
  setCheckingState();
  elements.backendUrl.textContent = backendUrl;

  try {
    const [healthResponse, messageResponse] = await Promise.all([
      fetch(`${backendUrl}/api/health`),
      fetch(`${backendUrl}/api/message`)
    ]);

    if (!healthResponse.ok || !messageResponse.ok) {
      throw new Error("Le backend a repondu avec une erreur.");
    }

    const health = await healthResponse.json();
    const message = await messageResponse.json();

    setBadge("Connecte", "success");
    elements.backendState.textContent = health.status;
    elements.backendPort.textContent = String(health.port ?? "-");
    elements.checkedAt.textContent = formatter.format(new Date(health.timestamp));
    elements.messageTitle.textContent = message.title;
    elements.messageBody.textContent = message.message;
  } catch (error) {
    setBadge("Indisponible", "error");
    elements.backendState.textContent = "Hors ligne";
    elements.backendPort.textContent = "-";
    elements.checkedAt.textContent = formatter.format(new Date());
    elements.messageTitle.textContent = "Backend non joignable";
    elements.messageBody.textContent =
      "Demarre le backend avec `pnpm dev` dans le dossier backend, puis recharge cette page.";
    console.error(error);
  }
}

elements.refreshButton?.addEventListener("click", () => {
  void loadBackendStatus();
});

void loadBackendStatus();
