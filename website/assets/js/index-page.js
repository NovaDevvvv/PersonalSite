import { renderProjectCard } from "./components.js";
import { loadProjectsBundle } from "./projects-data.js";
import { animateNumber } from "./utils.js";

const projectsGrid = document.getElementById("projectsGrid");
const projectsCount = document.getElementById("projectsCount");
const totalEarned = document.getElementById("totalEarned");
const totalVisits = document.getElementById("totalVisits");
const totalFavorites = document.getElementById("totalFavorites");
const totalCheers = document.getElementById("totalCheers");
const totalVisitors = document.getElementById("totalVisitors");

let lastSignature = "";

function animateMetric(element, value, duration = 900) {
	if (!element) {
		return;
	}

	animateNumber(element, value, duration);
}

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
		projectsGrid.innerHTML = '<div class="col-12"><div class="alert alert-secondary mb-0">No projects found in projects.json.</div></div>';
		animateMetric(projectsCount, 0, 700);
		animateMetric(totalEarned, 0, 800);
		animateMetric(totalVisits, 0, 800);
		animateMetric(totalFavorites, 0, 800);
		animateMetric(totalCheers, 0, 800);
		animateMetric(totalVisitors, 0, 800);
		return;
	}

	projectsGrid.innerHTML = projects.map(renderProjectCard).join("");
	animateVisibleCounts(projectsGrid);
	animateMetric(projectsCount, projects.length, 900);

	const totals = projects.reduce((acc, project) => {
		if (project.comingSoon === true || Number(project.id) === -1) {
			return acc;
		}

		const stats = project.stats || {};
		acc.tokenEarned += Number(stats.tokenEarned || 0);
		acc.visitCount += Number(stats.visitCount || 0);
		acc.favoriteCount += Number(stats.favoriteCount || 0);
		acc.cheerCount += Number(stats.cheerCount || 0);
		acc.visitorCount += Number(stats.visitorCount || 0);
		return acc;
	}, {
		tokenEarned: 0,
		visitCount: 0,
		favoriteCount: 0,
		cheerCount: 0,
		visitorCount: 0,
	});

	animateMetric(totalEarned, totals.tokenEarned, 1000);
	animateMetric(totalVisits, totals.visitCount, 1000);
	animateMetric(totalFavorites, totals.favoriteCount, 1000);
	animateMetric(totalCheers, totals.cheerCount, 1000);
	animateMetric(totalVisitors, totals.visitorCount, 1000);
}

async function refreshProjects() {
	try {
		const { projects } = await loadProjectsBundle();
		const signature = buildSignature(projects);

		if (signature !== lastSignature) {
			lastSignature = signature;
			renderProjects(projects);
		}
	} catch (error) {
		projectsGrid.innerHTML = '<div class="col-12"><div class="alert alert-danger mb-0">Could not load projects data.</div></div>';
		console.error(error);
	}
}

refreshProjects();
setInterval(refreshProjects, 3000);
