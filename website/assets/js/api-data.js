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
	const candidates = ["api.json", "/api.json", "../api.json"];
	let raw = null;
	let lastError = null;

	for (const candidate of candidates) {
		try {
			const response = await fetch(`${candidate}?t=${Date.now()}`, { cache: "no-store" });
			if (!response.ok) {
				lastError = new Error(`Failed to load ${candidate} (${response.status})`);
				continue;
			}

			raw = await response.json();
			break;
		} catch (error) {
			lastError = error;
		}
	}

	if (raw === null) {
		throw lastError || new Error("Failed to load api.json");
	}

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
