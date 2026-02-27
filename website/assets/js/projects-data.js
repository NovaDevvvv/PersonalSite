export async function loadProjectsBundle() {
	const response = await fetch(`projects.json?t=${Date.now()}`, { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`Failed to load projects.json (${response.status})`);
	}

	const raw = await response.json();

	if (Array.isArray(raw)) {
		return { projects: raw, totalTokensEarned: 0 };
	}

	const totalTokensEarned = Number(raw.totalTokensEarned || 0);
	const projects = Object.entries(raw)
		.filter(([key, value]) => key !== "totalTokensEarned" && value && typeof value === "object")
		.map(([, value]) => value);

	return { projects, totalTokensEarned };
}

export async function loadProjectsData() {
	const { projects } = await loadProjectsBundle();
	return projects;
}
