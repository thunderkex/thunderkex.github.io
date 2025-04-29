import ThreeMap from './three-map.js';

let threeMap;

async function fetchGitHubProfile() {
    const profileContent = document.getElementById('profile-content');
    profileContent.innerHTML = '<div class="loading">Loading profile data...</div>';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const [userResponse, reposResponse] = await Promise.all([
            fetch('https://api.github.com/users/thunderkex', { signal: controller.signal }),
            fetch('https://api.github.com/users/thunderkex/repos?per_page=100', { signal: controller.signal })
        ]);

        clearTimeout(timeoutId);

        if (userResponse.status === 403 || reposResponse.status === 403) {
            throw new Error('GitHub API rate limit exceeded. Please try again later.');
        }

        if (!userResponse.ok || !reposResponse.ok) {
            throw new Error('Failed to fetch GitHub data');
        }

        const userData = await userResponse.json();
        const reposData = await reposResponse.json();
        
        // Sort repositories by stars
        reposData.sort((a, b) => b.stargazers_count - a.stargazers_count);
        
        // Calculate total stars and languages
        const totalStars = reposData.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        const languages = reposData.reduce((acc, repo) => {
            if (repo.language) {
                acc[repo.language] = (acc[repo.language] || 0) + 1;
            }
            return acc;
        }, {});
        
        const topLanguages = Object.entries(languages)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang]) => lang)
            .join(', ');

        const content = `
            <div class="profile-info">
                <div>
                    <img src="${userData.avatar_url}" alt="Profile" class="avatar">
                </div>
                <div>
                    <h2>${userData.name || userData.login}</h2>
                    ${userData.bio ? `<p>${userData.bio}</p>` : ''}
                    <p>${userData.location || ''}</p>
                    <div class="stats">
                        <div class="stat-box">
                            <div>Total Stars</div>
                            <strong>⭐ ${totalStars}</strong>
                        </div>
                        <div class="stat-box">
                            <div>Repositories</div>
                            <strong>${userData.public_repos}</strong>
                        </div>
                        <div class="stat-box">
                            <div>Followers</div>
                            <strong>${userData.followers}</strong>
                        </div>
                    </div>
                    <div class="extra-info">
                        <p><strong>Top Languages:</strong> ${topLanguages}</p>
                        <p><strong>Member Since:</strong> ${new Date(userData.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
            </div>
            <div class="repositories">
                <h3>Repositories (sorted by stars)</h3>
                <div class="repos-grid">
                    ${reposData.map(repo => `
                        <div class="repo-card">
                            <h4><a href="${repo.html_url}" target="_blank">${repo.name}</a></h4>
                            <p>${repo.description || 'No description available'}</p>
                            <div class="repo-stats">
                                <span>⭐ ${repo.stargazers_count}</span>
                                <span>🔀 ${repo.forks_count}</span>
                                ${repo.language ? `<span>📝 ${repo.language}</span>` : ''}
                            </div>
                            <div class="repo-dates">
                                <small>Created: ${new Date(repo.created_at).toLocaleDateString()}</small>
                                <small>Updated: ${new Date(repo.updated_at).toLocaleDateString()}</small>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        profileContent.innerHTML = content;
    } catch (error) {
        let errorMessage = 'Error loading profile';
        if (error.name === 'AbortError') {
            errorMessage = 'Request timed out. Please check your connection and try again.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        profileContent.innerHTML = `<div class="error">${errorMessage}</div>`;
        console.error('Error:', error);
    }
}

function initThreeJS() {
    threeMap = new ThreeMap();
}

// Initialize everything
initThreeJS();
fetchGitHubProfile();

// Add styles
const styles = `
    .globe-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        z-index: -1;
        opacity: 0.7;
    }
    
    @media (max-width: 768px) {
        .globe-container {
            height: 50vh;
        }
        
        .profile-info {
            flex-direction: column;
            align-items: center;
            text-align: center;
        }
        
        .repos-grid {
            grid-template-columns: 1fr;
        }
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);