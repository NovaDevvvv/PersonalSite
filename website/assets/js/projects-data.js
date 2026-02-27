export async function loadProjectsBundle() {
	const response = await fetch(`projects.json?t=${Date.now()}`, { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`Failed to load projects.json (${response.status})`);
	}

	const raw = await response.json();
	console.log("[projects-data] fetched projects.json", raw);

	if (Array.isArray(raw)) {
		return { projects: raw };
	}

	const projects = Object.entries(raw)
		.filter(([, value]) => value && typeof value === "object" && "id" in value)
		.map(([, value]) => value);

	return { projects };
}

export async function loadProjectsData() {
	const { projects } = await loadProjectsBundle();
	return projects;
}
