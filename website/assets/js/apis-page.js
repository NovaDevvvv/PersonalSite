import { loadApisData } from "./api-data.js";
import { escapeHtml } from "./utils.js";

const apiGrid = document.getElementById("apiGrid");

function renderApiCard(api) {
	const title = escapeHtml(api.name || "Untitled API");
	const summary = escapeHtml(api.description || "No description provided.");
	const endpoints = Array.isArray(api.endpoints) ? api.endpoints : [];
	const repositories = Array.isArray(api.repositories) ? api.repositories : [];

	const endpointHtml = endpoints.length
		? endpoints.map((endpoint) => {
			const method = escapeHtml((endpoint.method || "GET").toUpperCase());
			const route = escapeHtml(endpoint.path || "/");
			const details = escapeHtml(endpoint.description || "");

			return `
				<li class="api-endpoint-item">
					<span class="api-method">${method}</span>
					<code class="api-route">${route}</code>
					${details ? `<small class="text-secondary d-block mt-1">${details}</small>` : ""}
				</li>
			`;
		}).join("")
		: '<li class="api-endpoint-item"><small class="text-secondary">No endpoints listed yet.</small></li>';

	const repoHtml = repositories.length
		? repositories.map((repo) => {
			const repoName = escapeHtml(repo.name || "Repository");
			const repoUrl = escapeHtml(repo.url || "#");
			return `<a href="${repoUrl}" class="badge text-bg-secondary text-decoration-none" target="_blank" rel="noopener noreferrer"><i class="fa-brands fa-github me-1"></i>${repoName}</a>`;
		}).join(" ")
		: '<span class="badge text-bg-secondary">No repo linked</span>';

	return `
		<div class="col-12 col-lg-6">
			<article class="glass-card h-100 api-card">
				<h3 class="h5 mb-2">${title}</h3>
				<p class="text-secondary mb-3">${summary}</p>
				<div class="api-section mb-3">
					<p class="api-label mb-2"><i class="fa-solid fa-link me-2"></i>Endpoints</p>
					<ul class="api-endpoints list-unstyled mb-0">${endpointHtml}</ul>
				</div>
				<div class="api-section">
					<p class="api-label mb-2"><i class="fa-brands fa-github me-2"></i>Repositories</p>
					<div class="d-flex flex-wrap gap-2">${repoHtml}</div>
				</div>
			</article>
		</div>
	`;
}

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
