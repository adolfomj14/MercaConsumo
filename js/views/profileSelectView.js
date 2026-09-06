// Pantalla de Selección de Perfil Familiar — estilo Netflix (solo Plan Pro)
import { state } from '../state.js';
import { fetchFamilyProfiles, ensureOwnerProfile, MAX_FAMILY_PROFILES } from '../services/profiles.js';
import { openProfileEditorModal } from './profileEditorModal.js';

function avatarHtml(p, size = 68) {
  if (p.avatar_type === 'photo' && p.avatar_value) {
    return `<img src="${p.avatar_value}" style="width:${size}px; height:${size}px; border-radius:18px; object-fit:cover; display:block;">`;
  }
  const bg = (p.color || '#10B981') + '26';
  return `<div style="width:${size}px; height:${size}px; border-radius:18px; background:${bg}; display:flex; align-items:center; justify-content:center; font-size:${Math.round(size * 0.5)}px;">${p.avatar_value || '🙂'}</div>`;
}

export async function renderProfileSelectView(container, onProfileChosen) {
  container.innerHTML = `
    <div style="min-height: calc(100vh - 60px); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:28px; padding: 20px 0;">
      <div style="text-align:center;">
        <div style="font-size:2.2rem;">🥑</div>
        <h1 style="font-size:1.3rem; font-weight:800; margin-top:6px;">¿Quién va a comprar hoy?</h1>
        <p style="color: var(--text-muted); font-size:0.85rem; margin-top:2px;">Elige tu perfil familiar</p>
      </div>
      <div id="profile-grid" style="display:flex; flex-wrap:wrap; justify-content:center; gap:20px; max-width: 480px;">
        <div style="color:var(--text-muted); font-size:0.9rem;">Cargando perfiles...</div>
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-profile-edit-mode" style="font-size:0.8rem;">
        ✏️ Editar Perfiles
      </button>
    </div>
  `;

  await ensureOwnerProfile();
  let profiles = await fetchFamilyProfiles();
  let editMode = false;

  function renderGrid() {
    const grid = document.getElementById('profile-grid');
    if (!grid) return;

    grid.innerHTML = `
      ${profiles.map(p => `
        <div class="profile-tile" data-id="${p.id}" style="position:relative; display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; width:92px;">
          ${avatarHtml(p)}
          ${editMode ? `<div class="profile-edit-badge" data-id="${p.id}" style="position:absolute; top:-6px; right:6px; background:var(--primary); color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem;">✏️</div>` : ''}
          <span style="font-size:0.85rem; font-weight:600; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:92px;">${p.name}</span>
        </div>
      `).join('')}
      ${profiles.length < MAX_FAMILY_PROFILES ? `
        <div class="profile-tile" id="profile-add-tile" style="display:flex; flex-direction:column; align-items:center; gap:8px; cursor:pointer; width:92px;">
          <div style="width:68px; height:68px; border-radius:18px; border:2px dashed var(--border); display:flex; align-items:center; justify-content:center; font-size:1.7rem; color:var(--text-muted);">+</div>
          <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Añadir</span>
        </div>
      ` : ''}
    `;

    grid.querySelectorAll('.profile-tile[data-id]').forEach(tile => {
      tile.addEventListener('click', () => {
        const id = tile.getAttribute('data-id');
        const chosen = profiles.find(p => p.id === id);
        if (!chosen) return;

        if (editMode) {
          openProfileEditorModal({
            existing: chosen,
            onSaved: async () => { profiles = await fetchFamilyProfiles(); renderGrid(); },
            onDeleted: async () => { profiles = await fetchFamilyProfiles(); renderGrid(); }
          });
          return;
        }

        state.setActiveProfile({
          id: chosen.id,
          name: chosen.name,
          avatar_type: chosen.avatar_type,
          avatar_value: chosen.avatar_value,
          color: chosen.color
        });
        onProfileChosen();
      });
    });

    document.getElementById('profile-add-tile')?.addEventListener('click', () => {
      openProfileEditorModal({
        onSaved: async () => { profiles = await fetchFamilyProfiles(); renderGrid(); }
      });
    });
  }

  document.getElementById('btn-profile-edit-mode')?.addEventListener('click', (e) => {
    editMode = !editMode;
    e.target.textContent = editMode ? '✅ Listo' : '✏️ Editar Perfiles';
    renderGrid();
  });

  renderGrid();
}
