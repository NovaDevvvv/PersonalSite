import { escapeHtml, formatDescription } from "./utils.js";

export function renderProjectCard(project) {
	const isComingSoon = project.comingSoon === true || Number(project.id) === -1;
	const stats = project.stats || {};
	const cheerCount = Number(stats.cheerCount || 0);
	const favoriteCount = Number(stats.favoriteCount || 0);
	const visitCount = Number(stats.visitCount || 0);
	const visitorCount = Number(stats.visitorCount || 0);
	const imageUrl = project.imageUrl || (project.imageName ? `https://img.rec.net/${project.imageName}` : "");
	const safeImageUrl = imageUrl || (isComingSoon ? "assets/comingSoon.jpg" : "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80");
	const title = escapeHtml(project.title || "Untitled Project");
	const description = formatDescription(
		isComingSoon
			? (project.description || "Still in progress — updates coming soon.")
			: (project.description || "No description added yet.")
	);
	const link = escapeHtml(project.link || "#");
	const statsLink = escapeHtml(project.statsPath || "");

	return `
		<div class="col-md-6 col-lg-4">
			<div class="card project-card h-100 border-0 glass-card ${isComingSoon ? "coming-soon-card" : ""}">
				<img src="${escapeHtml(safeImageUrl)}" class="card-img-top" alt="${title}">
				<div class="card-body d-flex flex-column">
					<h5 class="card-title">${title}</h5>
					<p class="card-text text-secondary project-description mb-3">${description}</p>
					${isComingSoon
						? `<div class="d-flex flex-wrap gap-2 mt-auto mb-3"><span class="badge text-bg-warning"><i class="fa-solid fa-hourglass-half me-1"></i>Coming Soon</span></div>
						   <button class="btn btn-outline-secondary btn-sm" type="button" disabled>In Development</button>`
						: `<div class="d-flex flex-wrap gap-2 mt-auto mb-3 stats-badges">
							<span class="badge text-bg-primary-subtle"><i class="fa-solid fa-star me-1"></i><span class="smooth-count" data-target="${cheerCount}">0</span> Cheers</span>
							<span class="badge text-bg-info-subtle"><i class="fa-solid fa-heart me-1"></i><span class="smooth-count" data-target="${favoriteCount}">0</span> Favorites</span>
							<span class="badge text-bg-success-subtle"><i class="fa-solid fa-chart-line me-1"></i><span class="smooth-count" data-target="${visitCount}">0</span> Visits</span>
							<span class="badge text-bg-secondary"><i class="fa-solid fa-users me-1"></i><span class="smooth-count" data-target="${visitorCount}">0</span> Players</span>
						 </div>
						 <div class="d-flex gap-2 mt-auto">
							${statsLink
								? `<a href="${statsLink}" class="btn btn-outline-info btn-sm" target="_self">View Stats</a>`
								: `<button class="btn btn-outline-secondary btn-sm" type="button" disabled>Stats Unavailable</button>`}
							<a href="${link}" class="btn btn-outline-light btn-sm" target="_blank" rel="noopener noreferrer">View Project</a>
						 </div>`}
				</div>
			</div>
		</div>
	`;
}

export function renderProjectRow(project) {
	const isComingSoon = project.comingSoon === true || Number(project.id) === -1;
	const stats = project.stats || {};
	const cheerCount = Number(stats.cheerCount || 0);
	const favoriteCount = Number(stats.favoriteCount || 0);
	const visitCount = Number(stats.visitCount || 0);
	const visitorCount = Number(stats.visitorCount || 0);
	const imageUrl = project.imageUrl || (project.imageName ? `https://img.rec.net/${project.imageName}` : "");
	const safeImageUrl = imageUrl || (isComingSoon ? "assets/comingSoon.jpg" : "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80");
	const title = escapeHtml(project.title || "Untitled Project");
	const description = formatDescription(
		isComingSoon
			? (project.description || "Still in progress - updates coming soon.")
			: (project.description || "No description added yet.")
	);
	const link = escapeHtml(project.link || "#");
	const statsLink = escapeHtml(project.statsPath || "");

	return `
		<article class="glass-card p-4 ${isComingSoon ? "coming-soon-card" : ""}">
			<div class="row g-4 align-items-start">
				<div class="col-lg-4">
					<img src="${escapeHtml(safeImageUrl)}" alt="${title}" class="project-image">
				</div>
				<div class="col-lg-8">
					<h3 class="mb-3">${title}</h3>
					<p class="text-secondary project-description-full mb-3">${description}</p>
					${isComingSoon
						? `<div class="d-flex flex-wrap gap-2 mb-3"><span class="badge text-bg-warning"><i class="fa-solid fa-hourglass-half me-1"></i>Coming Soon</span></div>
						   <button class="btn btn-outline-secondary" type="button" disabled>In Development</button>`
						: `<div class="d-flex flex-wrap gap-2 mb-3 stats-badges">
							<span class="badge text-bg-primary-subtle"><i class="fa-solid fa-star me-1"></i><span class="smooth-count" data-target="${cheerCount}">0</span> Cheers</span>
							<span class="badge text-bg-info-subtle"><i class="fa-solid fa-heart me-1"></i><span class="smooth-count" data-target="${favoriteCount}">0</span> Favorites</span>
							<span class="badge text-bg-success-subtle"><i class="fa-solid fa-chart-line me-1"></i><span class="smooth-count" data-target="${visitCount}">0</span> Visits</span>
							<span class="badge text-bg-secondary"><i class="fa-solid fa-users me-1"></i><span class="smooth-count" data-target="${visitorCount}">0</span> Players</span>
						 </div>
						 <div class="d-flex gap-2 flex-wrap">
							${statsLink
								? `<a href="${statsLink}" class="btn btn-outline-info" target="_self">View Stats</a>`
								: `<button class="btn btn-outline-secondary" type="button" disabled>Stats Unavailable</button>`}
							<a href="${link}" class="btn btn-outline-light" target="_blank" rel="noopener noreferrer">Open Project</a>
						 </div>`}
				</div>
			</div>
		</article>
	`;
}

export function renderApiCard(api) {
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
