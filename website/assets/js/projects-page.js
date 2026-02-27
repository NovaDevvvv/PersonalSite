import { renderProjectRow } from "./components.js";
import { loadProjectsData } from "./projects-data.js";
import { animateNumber } from "./utils.js";

const projectsList = document.getElementById("projectsList");
let lastSignature = "";
let refreshInFlight = false;

function animateVisibleCounts(scope = document) {
	const elements = scope.querySelectorAll(".smooth-count[data-target]");
	elements.forEach((element) => {
		animateNumber(element, Number(element.dataset.target || 0), 800);
	});
}

function buildSignature(projects) {
	return JSON.stringify(projects);
}

function renderProjects(projects) {
	if (!projects.length) {
		projectsList.innerHTML = '<div class="alert alert-secondary mb-0">No projects found in projects.json.</div>';
		return;
	}

	projectsList.innerHTML = projects.map(renderProjectRow).join("");
	animateVisibleCounts(projectsList);
}

async function refreshProjects() {
	if (refreshInFlight) {
		return;
	}

	refreshInFlight = true;

	try {
		const projects = await loadProjectsData();
		const signature = buildSignature(projects);

		if (signature !== lastSignature) {
			lastSignature = signature;
			renderProjects(projects);
		}
	} catch (error) {
		if (error?.name === "AbortError") {
			return;
		}

		projectsList.innerHTML = '<div class="alert alert-danger mb-0">Could not load projects data.</div>';
		console.error(error);
	} finally {
		refreshInFlight = false;
	}
}

refreshProjects();
setInterval(refreshProjects, 30000);
