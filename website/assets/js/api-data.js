function inferMethod(endpointUrl, endpoint) {
	const explicit = String(endpoint?.method || "").trim().toUpperCase();
	if (explicit) {
		return explicit;
	}

	const lower = String(endpointUrl || "").toLowerCase();
	if (lower.includes("/modify") || lower.includes("/create") || lower.includes("/update") || lower.includes("/auth")) {
		return "POST";
	}

	return "GET";
}

function extractPath(endpointUrl) {
	try {
		const parsed = new URL(endpointUrl);
		return `${parsed.pathname}${parsed.search}` || endpointUrl;
	} catch {
		return String(endpointUrl || "/");
	}
}

function normalizeApiMap(rawMap) {
	return Object.entries(rawMap).map(([name, api]) => {
		const endpointMap = api?.endpoints && typeof api.endpoints === "object" ? api.endpoints : {};
		const endpoints = Object.entries(endpointMap).map(([url, endpoint]) => ({
			method: inferMethod(url, endpoint),
			path: extractPath(url),
			description: endpoint?.description || "",
			parameters: endpoint?.parameters || {},
			responseExample: endpoint?.response ?? null,
		}));

		const repositories = Array.isArray(api?.repositories)
			? api.repositories
			: (api?.url ? [{ name: name, url: api.url }] : []);

		return {
			name,
			description: api?.description || "",
			endpoints,
			repositories,
		};
	});
}

export async function loadApisData() {
	const response = await fetch(`api.json?t=${Date.now()}`, { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`Failed to load api.json (${response.status})`);
	}

	const raw = await response.json();

	if (Array.isArray(raw)) {
		return raw;
	}

	if (raw && Array.isArray(raw.apis)) {
		return raw.apis;
	}

	if (raw && typeof raw === "object") {
		return normalizeApiMap(raw);
	}

	return [];
}
