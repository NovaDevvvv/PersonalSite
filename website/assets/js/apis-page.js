import { renderApiCard } from "./components.js";
import { loadApisData } from "./api-data.js";

const apiGrid = document.getElementById("apiGrid");

async function loadApis() {
	if (!apiGrid) {
		return;
	}

	apiGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">Loading API examples…</div></div>';

	try {
		const apis = await loadApisData();

		if (!apis.length) {
			apiGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No API examples configured yet.</div></div>';
			return;
		}

		apiGrid.innerHTML = apis.map(renderApiCard).join("");
	} catch (error) {
		const message = String(error?.message || "Unknown error");
		apiGrid.innerHTML = `<div class="col-12"><div class="alert alert-danger mb-0">Could not load API data. ${message}</div></div>`;
		console.error(error);
	}
}

loadApis();
setInterval(loadApis, 30000);
