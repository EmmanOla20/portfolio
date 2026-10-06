// ---------- Load Projects ----------
async function loadProjects() {
  const container = document.querySelector('#projects');
  container.innerHTML = '<p class="muted-text">Loading projects...</p>';

  try {
    const res = await fetch('/api/projects');
    if (!res.ok) throw new Error('Failed to fetch');

    const projects = await res.json();

    if (projects.length === 0) {
      container.innerHTML = '<p class="muted-text">No projects found.</p>';
      return;
    }

    container.innerHTML = projects.map(p => `
      <article class="card">
        <h3>${p.title}</h3>
        <p>${p.description}</p>
        <p>${p.tags.map(t => `<span>${t}</span>`).join(' ')}</p>
        <a href="${p.url}" target="_blank" rel="noopener">View project &rarr;</a>
      </article>
    `).join('');

  } catch (err) {
    container.innerHTML = '<p style="color: #f87171;">Could not load projects.</p>';
    console.error(err);
  }
}

// ---------- Contact Form Handling ----------
const form = document.querySelector('#contact-form');
const statusEl = document.querySelector('#form-status');
const submitBtn = document.querySelector('#submit-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    name: document.querySelector('#name').value,
    email: document.querySelector('#email').value,
    message: document.querySelector('#message').value
  };

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  statusEl.textContent = '';
  statusEl.style.color = 'var(--muted)';

  try {
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }

    statusEl.textContent = 'Thanks! Your message was sent.';
    statusEl.style.color = '#4ade80';
    form.reset();

  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.style.color = '#f87171';
    console.error(err);

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  }
});

// ---------- Init ----------
loadProjects();